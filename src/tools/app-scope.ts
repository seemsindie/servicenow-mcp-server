import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { logger } from "../utils/logger.ts";

/**
 * Application Scope Management tools.
 *
 * ServiceNow scoped applications require switching the active application context
 * before creating records that should be captured in that scope. These tools use
 * the UI API (`/api/now/ui/concoursepicker/application`) to switch scope, and
 * the Table API on `sys_app` / `sys_scope` to look up applications.
 *
 * 2 tools: get current, set current.
 */
export function registerAppScopeTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool("sn_get_current_application", {
    description: [
      "Get the currently active application scope on the ServiceNow instance.",
      "Queries user preferences to determine which application scope is active,",
      "then looks up the application details.",
    ].join(" "),
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
    },
  }, async ({ instance }) => {
    const client = registry.resolve(instance);

    // Try the UI preferences API first
    try {
      const response = await client.requestRaw("GET", "/api/now/ui/concoursepicker/application");
      const data = await response.json() as Record<string, unknown>;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            source: "concoursepicker",
            application: data["result"] ?? data,
          }, null, 2),
        }],
      };
    } catch (err) {
      logger.debug(`concoursepicker/application failed: ${err}`);
    }

    // Fallback: query sys_user_preference for apps.current
    try {
      const prefResult = await client.queryTable("sys_user_preference", {
        sysparm_query: "name=apps.current",
        sysparm_fields: "sys_id,name,value",
        sysparm_limit: 1,
      });
      const pref = prefResult.records[0];
      if (pref && pref["value"]) {
        // Look up the app name
        const appSysId = pref["value"] as string;
        try {
          const app = await client.getRecord("sys_scope", appSysId, {
            sysparm_fields: "sys_id,name,scope,short_description,version",
            sysparm_display_value: "true",
            sysparm_exclude_reference_link: "true",
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ source: "user_preference", application: app }, null, 2),
            }],
          };
        } catch {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ source: "user_preference", application_sys_id: appSysId, note: "Could not look up app details." }, null, 2),
            }],
          };
        }
      }
    } catch (err) {
      logger.debug(`user_preference lookup failed: ${err}`);
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ note: "Could not determine current application scope. The default Global scope may be active." }, null, 2),
      }],
    };
  });

  server.registerTool("sn_set_application_scope", {
    description: [
      "Switch the active application scope on the ServiceNow instance.",
      "This is required before creating records that should be captured in a specific scoped application.",
      "Accepts either a sys_id directly or an app scope string (e.g. 'x_myapp_mymodule') to look up.",
      "Uses the UI API: PUT /api/now/ui/concoursepicker/application.",
    ].join(" "),
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      app_sys_id: z.string().optional().describe("sys_id of the application (sys_scope or sys_app record)"),
      scope: z.string().optional().describe("Application scope string (e.g. 'global', 'x_myapp_module'). Will be looked up to find the sys_id."),
    },
  }, async ({ instance, app_sys_id, scope }) => {
    const client = registry.resolve(instance);

    // Resolve the sys_id if a scope string was provided instead
    let resolvedSysId = app_sys_id;
    if (!resolvedSysId && scope) {
      logger.info(`Looking up application scope: ${scope}`);
      const result = await client.queryTable("sys_scope", {
        sysparm_query: `scope=${scope}`,
        sysparm_fields: "sys_id,name,scope",
        sysparm_limit: 1,
      });
      const app = result.records[0];
      if (!app) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: `Application scope '${scope}' not found.` }, null, 2),
          }],
        };
      }
      resolvedSysId = app["sys_id"] as string;
      logger.info(`Resolved scope '${scope}' to sys_id: ${resolvedSysId}`);
    }

    if (!resolvedSysId) {
      return {
        content: [{
          type: "text" as const,
          text: "Provide either app_sys_id or scope.",
        }],
      };
    }

    // Validate sys_id format (32 hex chars)
    if (!/^[0-9a-f]{32}$/i.test(resolvedSysId)) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: `Invalid sys_id format: '${resolvedSysId}'. Expected 32 hex characters.` }, null, 2),
        }],
      };
    }

    // Try UI API to switch scope
    try {
      const response = await client.requestRaw("PUT", "/api/now/ui/concoursepicker/application", {
        app_id: resolvedSysId,
      });
      const data = await response.json() as Record<string, unknown>;
      logger.info(`Application scope switched to: ${resolvedSysId}`);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            method: "concoursepicker",
            app_sys_id: resolvedSysId,
            result: data["result"] ?? data,
          }, null, 2),
        }],
      };
    } catch (err) {
      logger.warn(`concoursepicker/application PUT failed: ${err}`);
    }

    // Fallback: set the user preference directly
    try {
      // Check if preference exists
      const prefResult = await client.queryTable("sys_user_preference", {
        sysparm_query: "name=apps.current",
        sysparm_fields: "sys_id",
        sysparm_limit: 1,
      });
      const existing = prefResult.records[0];

      if (existing) {
        await client.updateRecord("sys_user_preference", existing["sys_id"] as string, {
          value: resolvedSysId,
        });
      } else {
        await client.createRecord("sys_user_preference", {
          name: "apps.current",
          value: resolvedSysId,
        });
      }

      logger.info(`Application scope set via user preference: ${resolvedSysId}`);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            method: "user_preference",
            app_sys_id: resolvedSysId,
            note: "Scope set via sys_user_preference. Some operations may require the concoursepicker API for full effect.",
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: `Failed to set application scope: ${err instanceof Error ? err.message : String(err)}`,
            app_sys_id: resolvedSysId,
          }, null, 2),
        }],
      };
    }
  });
}
