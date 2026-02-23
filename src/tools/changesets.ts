import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";

export function registerChangesetTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool("sn_list_update_sets", {
    description: "List update sets from ServiceNow.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      query: z.string().optional(), state: z.string().optional().describe("in progress, complete, ignore, etc."),
      limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0),
    },
  }, async ({ instance, query, state, limit, offset }) => {
    const client = registry.resolve(instance);
    const parts: string[] = [];
    if (query) parts.push(query);
    if (state) parts.push(`state=${state}`);
    const result = await client.queryTable("sys_update_set", {
      sysparm_query: joinQueries(...parts, "ORDERBYDESCsys_created_on"),
      sysparm_fields: "sys_id,name,description,state,application,release_date,installed_from,sys_created_by,sys_created_on",
      sysparm_limit: limit, sysparm_offset: offset, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
    });
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, update_sets: result.records }, null, 2) }] };
  });

  server.registerTool("sn_get_update_set", {
    description: "Get update set details including its records.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string(),
    },
  }, async ({ instance, sys_id }) => {
    const client = registry.resolve(instance);
    const [updateSet, records] = await Promise.all([
      client.getRecord("sys_update_set", sys_id, { sysparm_display_value: "all", sysparm_exclude_reference_link: "true" }),
      client.queryTable("sys_update_xml", {
        sysparm_query: `update_set=${sys_id}^ORDERBYname`, sysparm_limit: 200,
        sysparm_fields: "sys_id,name,type,target_name,action", sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      }),
    ]);
    return { content: [{ type: "text" as const, text: JSON.stringify({ update_set: updateSet, records_count: records.records.length, records: records.records }, null, 2) }] };
  });

  server.registerTool("sn_create_update_set", {
    description: "Create a new update set.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      name: z.string(), description: z.string().optional(), application: z.string().optional().describe("Application sys_id"),
    },
  }, async (params) => {
    const client = registry.resolve(params.instance);
    const data: Record<string, unknown> = { state: "in progress" };
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && k !== "instance") data[k] = v; }
    const record = await client.createRecord("sys_update_set", data);
    return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], record }, null, 2) }] };
  });

  server.registerTool("sn_update_update_set", {
    description: "Update an existing update set.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string(), data: z.record(z.string(), z.unknown()),
    },
  }, async ({ instance, sys_id, data }) => {
    const client = registry.resolve(instance);
    const record = await client.updateRecord("sys_update_set", sys_id, data);
    return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, record }, null, 2) }] };
  });

  server.registerTool("sn_set_current_update_set", {
    description: "Set an update set as the current/active one.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().describe("Update set sys_id to make current"),
    },
  }, async ({ instance, sys_id }) => {
    const client = registry.resolve(instance);
    const record = await client.updateRecord("sys_update_set", sys_id, { state: "in progress" });
    return { content: [{ type: "text" as const, text: JSON.stringify({ set_current: true, sys_id, name: record["name"] }, null, 2) }] };
  });

  server.registerTool("sn_commit_update_set", {
    description: "Commit (complete) an update set.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string(),
    },
  }, async ({ instance, sys_id }) => {
    const client = registry.resolve(instance);
    const record = await client.updateRecord("sys_update_set", sys_id, { state: "complete" });
    return { content: [{ type: "text" as const, text: JSON.stringify({ committed: true, sys_id, state: "complete", name: record["name"] }, null, 2) }] };
  });

  server.registerTool("sn_add_to_update_set", {
    description: "Add a record/file reference to an update set (creates sys_update_xml entry).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      update_set: z.string().describe("Update set sys_id"),
      name: z.string().describe("Name/identifier of the record being added"),
      type: z.string().optional().describe("Record type"),
      target_name: z.string().optional(),
      payload: z.string().optional().describe("XML payload of the record"),
    },
  }, async (params) => {
    const client = registry.resolve(params.instance);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && k !== "instance") data[k] = v; }
    const record = await client.createRecord("sys_update_xml", data);
    return { content: [{ type: "text" as const, text: JSON.stringify({ added: true, sys_id: record["sys_id"], record }, null, 2) }] };
  });
}
