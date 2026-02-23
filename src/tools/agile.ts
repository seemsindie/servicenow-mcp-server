import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";

/** Helper: register list/create/update triplet for an agile table */
function registerCrudTriple(
  server: McpServer,
  registry: InstanceRegistry,
  opts: {
    table: string;
    singular: string;
    plural: string;
    listFields: string;
    createFields: { name: string; schema: z.ZodType; desc: string; optional?: boolean }[];
  }
) {
  const { table, singular, plural, listFields } = opts;

  // List
  server.registerTool(
    `sn_list_${plural}`,
    {
      description: `List ${plural} from ServiceNow.`,
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        query: z.string().optional().describe("Encoded query"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ instance, query, limit, offset }: { instance?: string; query?: string; limit: number; offset: number }) => {
      const client = registry.resolve(instance);
      const result = await client.queryTable(table, {
        sysparm_query: joinQueries(query ?? "", `ORDERBYDESCsys_created_on`),
        sysparm_fields: listFields,
        sysparm_limit: limit, sysparm_offset: offset,
        sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, [plural]: result.records }, null, 2) }] };
    }
  );

  // Create
  const createSchema: Record<string, z.ZodType> = {
    instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
  };
  for (const f of opts.createFields) {
    createSchema[f.name] = f.optional
      ? (f.schema as z.ZodString).optional().describe(f.desc)
      : f.schema.describe(f.desc);
  }
  server.registerTool(
    `sn_create_${singular}`,
    {
      description: `Create a new ${singular} in ServiceNow.`,
      inputSchema: createSchema,
    },
    async (params: Record<string, unknown>) => {
      const client = registry.resolve(params.instance as string | undefined);
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) { if (v !== undefined && k !== "instance") data[k] = v; }
      const record = await client.createRecord(table, data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], number: record["number"], record }, null, 2) }] };
    }
  );

  // Update
  server.registerTool(
    `sn_update_${singular}`,
    {
      description: `Update an existing ${singular} in ServiceNow.`,
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe(`${singular} sys_id`),
        data: z.record(z.string(), z.unknown()).describe("Fields to update"),
      },
    },
    async ({ instance, sys_id, data }: { instance?: string; sys_id: string; data: Record<string, unknown> }) => {
      const client = registry.resolve(instance);
      const record = await client.updateRecord(table, sys_id, data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, sys_id: record["sys_id"], record }, null, 2) }] };
    }
  );
}

export function registerAgileTools(server: McpServer, registry: InstanceRegistry): void {

  registerCrudTriple(server, registry, {
    table: "rm_story", singular: "story", plural: "stories",
    listFields: "sys_id,number,short_description,state,priority,sprint,epic,assigned_to,story_points",
    createFields: [
      { name: "short_description", schema: z.string(), desc: "Story title" },
      { name: "description", schema: z.string(), desc: "Detailed description", optional: true },
      { name: "story_points", schema: z.string(), desc: "Story points estimate", optional: true },
      { name: "priority", schema: z.string(), desc: "Priority (1-4)", optional: true },
      { name: "sprint", schema: z.string(), desc: "Sprint sys_id", optional: true },
      { name: "epic", schema: z.string(), desc: "Epic sys_id", optional: true },
      { name: "assigned_to", schema: z.string(), desc: "Assigned user sys_id", optional: true },
      { name: "acceptance_criteria", schema: z.string(), desc: "Acceptance criteria", optional: true },
    ],
  });

  registerCrudTriple(server, registry, {
    table: "rm_epic", singular: "epic", plural: "epics",
    listFields: "sys_id,number,short_description,state,priority,product,assigned_to",
    createFields: [
      { name: "short_description", schema: z.string(), desc: "Epic title" },
      { name: "description", schema: z.string(), desc: "Description", optional: true },
      { name: "priority", schema: z.string(), desc: "Priority", optional: true },
      { name: "product", schema: z.string(), desc: "Product sys_id", optional: true },
      { name: "assigned_to", schema: z.string(), desc: "Assigned user sys_id", optional: true },
    ],
  });

  registerCrudTriple(server, registry, {
    table: "rm_scrum_task", singular: "scrum_task", plural: "scrum_tasks",
    listFields: "sys_id,number,short_description,state,type,story,assigned_to,remaining_hours",
    createFields: [
      { name: "short_description", schema: z.string(), desc: "Task title" },
      { name: "story", schema: z.string(), desc: "Parent story sys_id", optional: true },
      { name: "type", schema: z.string(), desc: "Task type", optional: true },
      { name: "assigned_to", schema: z.string(), desc: "Assigned user sys_id", optional: true },
      { name: "hours", schema: z.string(), desc: "Estimated hours", optional: true },
    ],
  });

  registerCrudTriple(server, registry, {
    table: "pm_project", singular: "project", plural: "projects",
    listFields: "sys_id,number,short_description,state,priority,percent_complete,start_date,end_date,project_manager",
    createFields: [
      { name: "short_description", schema: z.string(), desc: "Project name" },
      { name: "description", schema: z.string(), desc: "Description", optional: true },
      { name: "priority", schema: z.string(), desc: "Priority", optional: true },
      { name: "start_date", schema: z.string(), desc: "Start date", optional: true },
      { name: "end_date", schema: z.string(), desc: "End date", optional: true },
      { name: "project_manager", schema: z.string(), desc: "Project manager sys_id", optional: true },
    ],
  });
}
