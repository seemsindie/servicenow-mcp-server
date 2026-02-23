import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";

export function registerScriptTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool("sn_list_script_includes", {
    description: "List script includes from ServiceNow.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      query: z.string().optional(), name: z.string().optional().describe("Filter by name (LIKE match)"),
      active: z.boolean().optional(), api_name: z.string().optional().describe("Filter by API name"),
      limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0),
    },
  }, async ({ instance, query, name, active, api_name, limit, offset }) => {
    const client = registry.resolve(instance);
    const parts: string[] = [];
    if (query) parts.push(query);
    if (name) parts.push(`nameLIKE${name}`);
    if (active !== undefined) parts.push(`active=${active}`);
    if (api_name) parts.push(`api_name=${api_name}`);
    const result = await client.queryTable("sys_script_include", {
      sysparm_query: joinQueries(...parts, "ORDERBYname"),
      sysparm_fields: "sys_id,name,api_name,description,active,access,client_callable,sys_scope",
      sysparm_limit: limit, sysparm_offset: offset, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
    });
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, script_includes: result.records }, null, 2) }] };
  });

  server.registerTool("sn_get_script_include", {
    description: "Get a script include by sys_id or name (includes full script body).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().optional(), name: z.string().optional(),
    },
  }, async ({ instance, sys_id, name }) => {
    const client = registry.resolve(instance);
    if (sys_id) {
      const record = await client.getRecord("sys_script_include", sys_id, { sysparm_display_value: "false", sysparm_exclude_reference_link: "true" });
      return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
    }
    if (name) {
      const result = await client.queryTable("sys_script_include", { sysparm_query: `name=${name}`, sysparm_limit: 1, sysparm_exclude_reference_link: "true" });
      return { content: [{ type: "text" as const, text: JSON.stringify(result.records[0] ?? null, null, 2) }] };
    }
    return { content: [{ type: "text" as const, text: "Provide sys_id or name" }] };
  });

  server.registerTool("sn_create_script_include", {
    description: "Create a new script include in ServiceNow.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      name: z.string(), script: z.string().describe("JavaScript source code"), description: z.string().optional(),
      api_name: z.string().optional(), active: z.boolean().default(true),
      client_callable: z.boolean().default(false).describe("Whether it can be called from GlideAjax"),
      access: z.enum(["public", "package_private"]).default("public"),
    },
  }, async (params) => {
    const client = registry.resolve(params.instance);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && k !== "instance") data[k] = v; }
    const record = await client.createRecord("sys_script_include", data);
    return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], name: record["name"], record }, null, 2) }] };
  });

  server.registerTool("sn_update_script_include", {
    description: "Update an existing script include (commonly used to push script changes).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string(), data: z.record(z.string(), z.unknown()).describe("Fields to update (typically { script: '...' })"),
    },
  }, async ({ instance, sys_id, data }) => {
    const client = registry.resolve(instance);
    const record = await client.updateRecord("sys_script_include", sys_id, data);
    return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, name: record["name"], record }, null, 2) }] };
  });

  server.registerTool("sn_delete_script_include", {
    description: "Delete a script include.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string(),
    },
  }, async ({ instance, sys_id }) => {
    const client = registry.resolve(instance);
    await client.deleteRecord("sys_script_include", sys_id);
    return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, sys_id }, null, 2) }] };
  });
}
