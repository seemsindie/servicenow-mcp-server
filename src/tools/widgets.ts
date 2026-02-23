import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";

/**
 * Service Portal Widget tools.
 *
 * Covers `sp_widget` — the building blocks of ServiceNow Service Portal pages.
 * Each widget has multiple script components: HTML template, CSS, client script
 * (Angular controller), server script, link function, demo data, and option schema.
 *
 * 5 tools: list, get, create, update, delete.
 */
export function registerWidgetTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool("sn_list_widgets", {
    description: "List Service Portal widgets (sp_widget).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      query: z.string().optional().describe("Raw encoded query to append."),
      name: z.string().optional().describe("Filter by name (LIKE match)"),
      id: z.string().optional().describe("Filter by widget ID (exact match)"),
      category: z.string().optional().describe("Filter by category"),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    },
  }, async ({ instance, query, name, id, category, limit, offset }) => {
    const client = registry.resolve(instance);
    const parts: string[] = [];
    if (query) parts.push(query);
    if (name) parts.push(`nameLIKE${name}`);
    if (id) parts.push(`id=${id}`);
    if (category) parts.push(`category=${category}`);
    const q = joinQueries(...parts, "ORDERBYname");
    const result = await client.queryTable("sp_widget", {
      sysparm_query: q,
      sysparm_fields: "sys_id,name,id,category,data_table,sys_scope,sys_updated_on",
      sysparm_limit: limit,
      sysparm_offset: offset,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ count: result.records.length, pagination: result.pagination, widgets: result.records }, null, 2),
      }],
    };
  });

  server.registerTool("sn_get_widget", {
    description: [
      "Get a Service Portal widget with all script bodies.",
      "Returns: template (HTML body), css, client_script (Angular controller),",
      "server_script (server-side JS), link (Angular link function), demo_data,",
      "option_schema, and metadata.",
    ].join(" "),
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().optional().describe("Widget sys_id"),
      id: z.string().optional().describe("Widget ID (e.g. 'widget-cool-clock'). Alternative to sys_id."),
    },
  }, async ({ instance, sys_id, id }) => {
    const client = registry.resolve(instance);
    if (sys_id) {
      const record = await client.getRecord("sp_widget", sys_id, {
        sysparm_display_value: "false",
        sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
    }
    if (id) {
      const result = await client.queryTable("sp_widget", {
        sysparm_query: `id=${id}`,
        sysparm_limit: 1,
        sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(result.records[0] ?? null, null, 2) }] };
    }
    return { content: [{ type: "text" as const, text: "Provide sys_id or id." }] };
  });

  server.registerTool("sn_create_widget", {
    description: [
      "Create a new Service Portal widget (sp_widget) with all script components.",
      "A widget consists of an HTML template, CSS, client-side Angular controller,",
      "server-side script, and optional link function / demo data / option schema.",
    ].join(" "),
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      name: z.string().describe("Widget display name"),
      id: z.string().describe("Widget ID — unique identifier used in code (e.g. 'my-custom-widget')"),
      template: z.string().optional().describe("HTML template body (AngularJS markup)"),
      css: z.string().optional().describe("Widget CSS/SCSS styles"),
      client_script: z.string().optional().describe("Client-side JavaScript — Angular controller function"),
      server_script: z.string().optional().describe("Server-side JavaScript — runs on page load, populates data object"),
      link: z.string().optional().describe("Angular link function (advanced — for DOM manipulation)"),
      demo_data: z.string().optional().describe("JSON demo data for the widget preview"),
      option_schema: z.string().optional().describe("JSON schema defining widget instance options"),
      data_table: z.string().optional().describe("Default data table for the widget"),
      category: z.string().optional().describe("Widget category"),
      description: z.string().optional().describe("Widget description"),
    },
  }, async (params) => {
    const client = registry.resolve(params.instance);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && k !== "instance") data[k] = v;
    }
    const record = await client.createRecord("sp_widget", data);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ created: true, sys_id: record["sys_id"], name: record["name"], id: record["id"], record }, null, 2),
      }],
    };
  });

  server.registerTool("sn_update_widget", {
    description: [
      "Update an existing Service Portal widget (sp_widget).",
      "Commonly used to push script changes — template, css, client_script, server_script, etc.",
    ].join(" "),
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().describe("Widget sys_id"),
      data: z.record(z.string(), z.unknown()).describe("Fields to update (e.g. { server_script: '...', template: '...' })."),
    },
  }, async ({ instance, sys_id, data }) => {
    const client = registry.resolve(instance);
    const record = await client.updateRecord("sp_widget", sys_id, data);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ updated: true, name: record["name"], record }, null, 2),
      }],
    };
  });

  server.registerTool("sn_delete_widget", {
    description: "Delete a Service Portal widget (sp_widget).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().describe("Widget sys_id"),
    },
  }, async ({ instance, sys_id }) => {
    const client = registry.resolve(instance);
    await client.deleteRecord("sp_widget", sys_id);
    return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, sys_id }, null, 2) }] };
  });
}
