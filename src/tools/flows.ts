import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";

/**
 * Flow Designer tools.
 *
 * Covers:
 *  - sys_hub_flow          — Flow definitions
 *  - sys_hub_flow_logic    — Logic blocks (actions, conditions, etc.)
 *  - sys_hub_flow_variable — Flow input/output variables
 *  - sys_hub_flow_stage    — Flow stages
 *
 * IMPORTANT CAVEAT: Flow Designer logic blocks (actions, conditions, loops, etc.)
 * are stored in internal formats and cannot be fully created/compiled via the
 * REST Table API. These tools are primarily for:
 *  - Reading/inspecting existing flows
 *  - Creating basic flow definitions and variables
 *  - Listing flow stages
 * Complex flow logic must be built in the Flow Designer UI.
 *
 * 6 tools total.
 */
export function registerFlowTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool("sn_list_flows", {
    description: "List Flow Designer flows (sys_hub_flow).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      query: z.string().optional().describe("Raw encoded query to append."),
      name: z.string().optional().describe("Filter by name (LIKE match)"),
      active: z.boolean().optional(),
      scope: z.string().optional().describe("Filter by application scope (sys_scope display value)"),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    },
  }, async ({ instance, query, name, active, scope, limit, offset }) => {
    const client = registry.resolve(instance);
    const parts: string[] = [];
    if (query) parts.push(query);
    if (name) parts.push(`nameLIKE${name}`);
    if (active !== undefined) parts.push(`active=${active}`);
    if (scope) parts.push(`sys_scope.name=${scope}`);
    const q = joinQueries(...parts, "ORDERBYname");
    const result = await client.queryTable("sys_hub_flow", {
      sysparm_query: q,
      sysparm_fields: "sys_id,name,description,active,trigger_type,table,status,sys_scope,sys_updated_on",
      sysparm_limit: limit,
      sysparm_offset: offset,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ count: result.records.length, pagination: result.pagination, flows: result.records }, null, 2),
      }],
    };
  });

  server.registerTool("sn_get_flow", {
    description: [
      "Get a Flow Designer flow with its logic blocks and variables.",
      "Fetches the flow definition, all sys_hub_flow_logic records (actions/conditions),",
      "and all sys_hub_flow_variable records (inputs/outputs) in parallel.",
      "Note: Logic block internals may be in binary/internal format.",
    ].join(" "),
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      sys_id: z.string().describe("Flow sys_id (sys_hub_flow)"),
    },
  }, async ({ instance, sys_id }) => {
    const client = registry.resolve(instance);
    const [flow, logic, variables] = await Promise.all([
      client.getRecord("sys_hub_flow", sys_id, {
        sysparm_display_value: "all",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_hub_flow_logic", {
        sysparm_query: `flow=${sys_id}^ORDERBYorder`,
        sysparm_fields: "sys_id,name,type_id,order,active,parent,flow,sys_updated_on",
        sysparm_limit: 200,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_hub_flow_variable", {
        sysparm_query: `flow=${sys_id}^ORDERBYorder`,
        sysparm_fields: "sys_id,name,label,type,mandatory,default_value,flow,variable_type,order",
        sysparm_limit: 100,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          flow,
          logic_blocks: logic.records,
          variables: variables.records,
        }, null, 2),
      }],
    };
  });

  server.registerTool("sn_create_flow", {
    description: [
      "Create a basic Flow Designer flow definition (sys_hub_flow).",
      "This creates the flow container — logic blocks (actions, conditions) must be",
      "added through the Flow Designer UI as they cannot be fully created via REST.",
      "After creation, use the Flow Designer UI to add trigger configuration and actions.",
    ].join(" "),
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      name: z.string().describe("Flow name"),
      description: z.string().optional(),
      table: z.string().optional().describe("Table the flow operates on (for record-based triggers)"),
      trigger_type: z.string().optional().describe("Trigger type (e.g. 'record', 'schedule', 'application')"),
      active: z.boolean().default(false).describe("Whether the flow is active. Recommended: create as inactive, activate after configuring in UI."),
    },
  }, async (params) => {
    const client = registry.resolve(params.instance);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && k !== "instance") data[k] = v;
    }
    const record = await client.createRecord("sys_hub_flow", data);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          created: true,
          sys_id: record["sys_id"],
          name: record["name"],
          note: "Flow definition created. Add trigger configuration and actions via the Flow Designer UI.",
          record,
        }, null, 2),
      }],
    };
  });

  server.registerTool("sn_list_flow_variables", {
    description: "List input/output variables for a Flow Designer flow (sys_hub_flow_variable).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      flow_sys_id: z.string().describe("sys_hub_flow sys_id"),
      limit: z.number().int().min(1).max(100).default(50),
    },
  }, async ({ instance, flow_sys_id, limit }) => {
    const client = registry.resolve(instance);
    const result = await client.queryTable("sys_hub_flow_variable", {
      sysparm_query: `flow=${flow_sys_id}^ORDERBYorder`,
      sysparm_fields: "sys_id,name,label,type,mandatory,default_value,variable_type,order",
      sysparm_limit: limit,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ count: result.records.length, variables: result.records }, null, 2),
      }],
    };
  });

  server.registerTool("sn_create_flow_variable", {
    description: "Create an input or output variable for a Flow Designer flow (sys_hub_flow_variable).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      flow: z.string().describe("sys_hub_flow sys_id — the flow this variable belongs to"),
      name: z.string().describe("Variable internal name"),
      label: z.string().optional().describe("Variable display label"),
      type: z.string().describe("Data type (e.g. 'string', 'integer', 'boolean', 'reference', 'glide_date_time')"),
      variable_type: z.enum(["input", "output"]).default("input").describe("Whether this is an input or output variable"),
      mandatory: z.boolean().default(false),
      default_value: z.string().optional().describe("Default value for the variable"),
      order: z.number().int().optional().describe("Display order"),
    },
  }, async (params) => {
    const client = registry.resolve(params.instance);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && k !== "instance") data[k] = v;
    }
    const record = await client.createRecord("sys_hub_flow_variable", data);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ created: true, sys_id: record["sys_id"], name: record["name"], record }, null, 2),
      }],
    };
  });

  server.registerTool("sn_list_flow_stages", {
    description: "List stages for a Flow Designer flow (sys_hub_flow_stage).",
    inputSchema: {
      instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
      flow_sys_id: z.string().describe("sys_hub_flow sys_id"),
      limit: z.number().int().min(1).max(100).default(50),
    },
  }, async ({ instance, flow_sys_id, limit }) => {
    const client = registry.resolve(instance);
    const result = await client.queryTable("sys_hub_flow_stage", {
      sysparm_query: `flow=${flow_sys_id}^ORDERBYorder`,
      sysparm_fields: "sys_id,name,label,order,flow",
      sysparm_limit: limit,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ count: result.records.length, stages: result.records }, null, 2),
      }],
    };
  });
}
