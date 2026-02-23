import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServiceNowClient } from "../client/index.ts";

export function registerWorkflowTools(server: McpServer, client: ServiceNowClient): void {

  server.registerTool(
    "sn_list_workflows",
    {
      description: "List workflows from ServiceNow.",
      inputSchema: {
        query: z.string().optional(),
        active: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ query, active, limit, offset }) => {
      const parts: string[] = [];
      if (query) parts.push(query);
      if (active !== undefined) parts.push(`active=${active}`);
      const q = parts.length ? parts.join("^") + "^ORDERBYname" : "ORDERBYname";
      const result = await client.queryTable("wf_workflow", {
        sysparm_query: q, sysparm_fields: "sys_id,name,description,table,active,sys_updated_on",
        sysparm_limit: limit, sysparm_offset: offset, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, workflows: result.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_get_workflow",
    {
      description: "Get workflow details including activities.",
      inputSchema: {
        sys_id: z.string().describe("Workflow sys_id"),
      },
    },
    async ({ sys_id }) => {
      const [workflow, activities] = await Promise.all([
        client.getRecord("wf_workflow", sys_id, { sysparm_display_value: "all", sysparm_exclude_reference_link: "true" }),
        client.queryTable("wf_activity", {
          sysparm_query: `workflow_version.workflow=${sys_id}^ORDERBYx`, sysparm_limit: 200,
          sysparm_fields: "sys_id,name,activity_definition,x,y,out_of_date", sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
        }),
      ]);
      return { content: [{ type: "text" as const, text: JSON.stringify({ workflow, activities: activities.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_create_workflow",
    {
      description: "Create a new workflow.",
      inputSchema: {
        name: z.string(),
        table: z.string().describe("Table the workflow applies to"),
        description: z.string().optional(),
      },
    },
    async (params) => {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) { if (v !== undefined) data[k] = v; }
      const record = await client.createRecord("wf_workflow", data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_update_workflow",
    {
      description: "Update an existing workflow.",
      inputSchema: {
        sys_id: z.string(),
        data: z.record(z.string(), z.unknown()),
      },
    },
    async ({ sys_id, data }) => {
      const record = await client.updateRecord("wf_workflow", sys_id, data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_delete_workflow",
    {
      description: "Delete a workflow.",
      inputSchema: {
        sys_id: z.string().describe("Workflow sys_id"),
      },
    },
    async ({ sys_id }) => {
      await client.deleteRecord("wf_workflow", sys_id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, sys_id }, null, 2) }] };
    }
  );
}
