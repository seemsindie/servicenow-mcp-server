import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";

export function registerCmdbTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool("sn_list_ci", {
    description: "List Configuration Items from the CMDB. Can query any CI class (cmdb_ci, cmdb_ci_server, cmdb_ci_computer, etc.).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      ci_class: z.string().default("cmdb_ci").describe("CI class table (e.g. cmdb_ci, cmdb_ci_server, cmdb_ci_computer, cmdb_ci_app_server)"),
      query: z.string().optional(), name: z.string().optional().describe("Filter by name (LIKE)"),
      operational_status: z.string().optional().describe("1=Operational, 2=Non-Operational, 3=Repair in Progress, 6=Retired"),
      limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0),
    },
  }, async ({ instance, ci_class, query, name, operational_status, limit, offset }) => {
    const client = registry.resolve(instance);
    const parts: string[] = [];
    if (query) parts.push(query);
    if (name) parts.push(`nameLIKE${name}`);
    if (operational_status) parts.push(`operational_status=${operational_status}`);
    const result = await client.queryTable(ci_class, {
      sysparm_query: joinQueries(...parts, "ORDERBYname"),
      sysparm_fields: "sys_id,name,sys_class_name,operational_status,ip_address,os,category,subcategory,manufacturer,model_id,serial_number,asset_tag",
      sysparm_limit: limit, sysparm_offset: offset, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
    });
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, cis: result.records }, null, 2) }] };
  });

  server.registerTool("sn_get_ci", {
    description: "Get a Configuration Item by sys_id.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string(), ci_class: z.string().default("cmdb_ci"),
    },
  }, async ({ instance, sys_id, ci_class }) => {
    const client = registry.resolve(instance);
    const record = await client.getRecord(ci_class, sys_id, { sysparm_display_value: "all", sysparm_exclude_reference_link: "true" });
    return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
  });

  server.registerTool("sn_create_ci", {
    description: "Create a new Configuration Item in the CMDB.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      ci_class: z.string().default("cmdb_ci").describe("CI class table"),
      name: z.string().describe("CI name"),
      data: z.record(z.string(), z.unknown()).optional().describe("Additional field values"),
    },
  }, async ({ instance, ci_class, name, data }) => {
    const client = registry.resolve(instance);
    const body = { name, ...(data ?? {}) };
    const record = await client.createRecord(ci_class, body);
    return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], record }, null, 2) }] };
  });

  server.registerTool("sn_list_ci_relationships", {
    description: "List relationships for a Configuration Item.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      ci_sys_id: z.string().describe("CI sys_id"),
      limit: z.number().int().min(1).max(100).default(50),
    },
  }, async ({ instance, ci_sys_id, limit }) => {
    const client = registry.resolve(instance);
    const result = await client.queryTable("cmdb_rel_ci", {
      sysparm_query: `parent=${ci_sys_id}^ORchild=${ci_sys_id}`,
      sysparm_fields: "sys_id,parent,child,type",
      sysparm_limit: limit, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
    });
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, relationships: result.records }, null, 2) }] };
  });

  server.registerTool("sn_create_ci_relationship", {
    description: "Create a relationship between two CIs.",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      parent: z.string().describe("Parent CI sys_id"),
      child: z.string().describe("Child CI sys_id"),
      type: z.string().describe("Relationship type sys_id (from cmdb_rel_type table)"),
    },
  }, async ({ instance, parent, child, type }) => {
    const client = registry.resolve(instance);
    const record = await client.createRecord("cmdb_rel_ci", { parent, child, type });
    return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], record }, null, 2) }] };
  });
}
