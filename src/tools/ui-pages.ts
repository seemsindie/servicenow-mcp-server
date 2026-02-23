import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";

/**
 * UI Page tools.
 *
 * Covers `sys_ui_page` — standalone pages rendered outside the standard ServiceNow
 * form/list framework. Each UI page has an HTML body, client-side script, and
 * server-side processing script (Jelly/Glide).
 *
 * 5 tools: list, get, create, update, delete.
 */
export function registerUiPageTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool("sn_list_ui_pages", {
    description: "List UI pages from ServiceNow (sys_ui_page).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      query: z.string().optional().describe("Raw encoded query to append."),
      name: z.string().optional().describe("Filter by name (LIKE match)"),
      category: z.string().optional().describe("Filter by category"),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    },
  }, async ({ instance, query, name, category, limit, offset }) => {
    const client = registry.resolve(instance);
    const parts: string[] = [];
    if (query) parts.push(query);
    if (name) parts.push(`nameLIKE${name}`);
    if (category) parts.push(`category=${category}`);
    const q = joinQueries(...parts, "ORDERBYname");
    const result = await client.queryTable("sys_ui_page", {
      sysparm_query: q,
      sysparm_fields: "sys_id,name,category,description,direct,sys_scope,sys_updated_on",
      sysparm_limit: limit,
      sysparm_offset: offset,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ count: result.records.length, pagination: result.pagination, ui_pages: result.records }, null, 2),
      }],
    };
  });

  server.registerTool("sn_get_ui_page", {
    description: [
      "Get a UI page with all script bodies: html (Jelly/HTML body),",
      "client_script (client-side JS), and processing_script (server-side Jelly/Glide).",
    ].join(" "),
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().optional().describe("UI page sys_id"),
      name: z.string().optional().describe("UI page name (exact match). Alternative to sys_id."),
    },
  }, async ({ instance, sys_id, name }) => {
    const client = registry.resolve(instance);
    if (sys_id) {
      const record = await client.getRecord("sys_ui_page", sys_id, {
        sysparm_display_value: "false",
        sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
    }
    if (name) {
      const result = await client.queryTable("sys_ui_page", {
        sysparm_query: `name=${name}`,
        sysparm_limit: 1,
        sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(result.records[0] ?? null, null, 2) }] };
    }
    return { content: [{ type: "text" as const, text: "Provide sys_id or name." }] };
  });

  server.registerTool("sn_create_ui_page", {
    description: "Create a new UI page (sys_ui_page).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      name: z.string().describe("UI page name (also used as the URL slug: /<name>.do)"),
      html: z.string().optional().describe("HTML/Jelly body content"),
      client_script: z.string().optional().describe("Client-side JavaScript"),
      processing_script: z.string().optional().describe("Server-side processing script (Jelly/Glide)"),
      description: z.string().optional(),
      category: z.string().optional().describe("Page category"),
      direct: z.boolean().optional().describe("Whether the page can be accessed directly via URL"),
    },
  }, async (params) => {
    const client = registry.resolve(params.instance);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && k !== "instance") data[k] = v;
    }
    const record = await client.createRecord("sys_ui_page", data);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ created: true, sys_id: record["sys_id"], name: record["name"], record }, null, 2),
      }],
    };
  });

  server.registerTool("sn_update_ui_page", {
    description: "Update an existing UI page (sys_ui_page). Commonly used to push script/HTML changes.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().describe("UI page sys_id"),
      data: z.record(z.string(), z.unknown()).describe("Fields to update (e.g. { html: '...', client_script: '...' })."),
    },
  }, async ({ instance, sys_id, data }) => {
    const client = registry.resolve(instance);
    const record = await client.updateRecord("sys_ui_page", sys_id, data);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ updated: true, name: record["name"], record }, null, 2),
      }],
    };
  });

  server.registerTool("sn_delete_ui_page", {
    description: "Delete a UI page (sys_ui_page).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().describe("UI page sys_id"),
    },
  }, async ({ instance, sys_id }) => {
    const client = registry.resolve(instance);
    await client.deleteRecord("sys_ui_page", sys_id);
    return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, sys_id }, null, 2) }] };
  });
}
