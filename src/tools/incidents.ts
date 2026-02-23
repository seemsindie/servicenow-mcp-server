import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServiceNowClient } from "../client/index.ts";
import { joinQueries } from "../utils/query.ts";

export function registerIncidentTools(server: McpServer, client: ServiceNowClient): void {

  server.registerTool(
    "sn_list_incidents",
    {
      description: "List incidents from ServiceNow with optional filters. Returns number, description, state, priority, assignment info.",
      inputSchema: {
        query: z.string().optional().describe("Encoded query (e.g. 'active=true^priority=1')"),
        state: z.string().optional().describe("Filter by state: 1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed"),
        priority: z.string().optional().describe("Filter by priority: 1=Critical, 2=High, 3=Moderate, 4=Low, 5=Planning"),
        assignment_group: z.string().optional().describe("Filter by assignment group name or sys_id"),
        assigned_to: z.string().optional().describe("Filter by assigned user name or sys_id"),
        category: z.string().optional().describe("Filter by category"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ query, state, priority, assignment_group, assigned_to, category, limit, offset }) => {
      const parts: string[] = [];
      if (query) parts.push(query);
      if (state) parts.push(`state=${state}`);
      if (priority) parts.push(`priority=${priority}`);
      if (assignment_group) parts.push(`assignment_group.name=${assignment_group}`);
      if (assigned_to) parts.push(`assigned_to.user_name=${assigned_to}`);
      if (category) parts.push(`category=${category}`);

      const encodedQuery = joinQueries(...parts, "ORDERBYDESCsys_created_on");

      const result = await client.queryTable("incident", {
        sysparm_query: encodedQuery,
        sysparm_fields: "number,short_description,state,priority,urgency,impact,category,subcategory,assigned_to,assignment_group,caller_id,opened_at,sys_id",
        sysparm_limit: limit,
        sysparm_offset: offset,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, incidents: result.records }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "sn_create_incident",
    {
      description: "Create a new incident in ServiceNow.",
      inputSchema: {
        short_description: z.string().describe("Brief description of the incident"),
        description: z.string().optional().describe("Detailed description"),
        urgency: z.enum(["1", "2", "3"]).optional().describe("1=High, 2=Medium, 3=Low"),
        impact: z.enum(["1", "2", "3"]).optional().describe("1=High, 2=Medium, 3=Low"),
        category: z.string().optional(),
        subcategory: z.string().optional(),
        assignment_group: z.string().optional().describe("Assignment group sys_id or name"),
        assigned_to: z.string().optional().describe("Assigned user sys_id or user_name"),
        caller_id: z.string().optional().describe("Caller sys_id or user_name"),
        contact_type: z.string().optional().describe("How the incident was reported (e.g. phone, email, self-service)"),
      },
    },
    async (params) => {
      const data: Record<string, unknown> = { short_description: params.short_description };
      if (params.description) data["description"] = params.description;
      if (params.urgency) data["urgency"] = params.urgency;
      if (params.impact) data["impact"] = params.impact;
      if (params.category) data["category"] = params.category;
      if (params.subcategory) data["subcategory"] = params.subcategory;
      if (params.assignment_group) data["assignment_group"] = params.assignment_group;
      if (params.assigned_to) data["assigned_to"] = params.assigned_to;
      if (params.caller_id) data["caller_id"] = params.caller_id;
      if (params.contact_type) data["contact_type"] = params.contact_type;

      const record = await client.createRecord("incident", data);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ created: true, number: record["number"], sys_id: record["sys_id"], record }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "sn_update_incident",
    {
      description: "Update an existing incident in ServiceNow.",
      inputSchema: {
        sys_id: z.string().describe("Incident sys_id"),
        data: z.record(z.string(), z.unknown()).describe("Fields to update (e.g. { state: '2', assigned_to: 'user_sys_id' })"),
      },
    },
    async ({ sys_id, data }) => {
      const record = await client.updateRecord("incident", sys_id, data);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ updated: true, number: record["number"], sys_id: record["sys_id"], record }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "sn_add_incident_comment",
    {
      description: "Add a customer-visible comment to an incident.",
      inputSchema: {
        sys_id: z.string().describe("Incident sys_id"),
        comment: z.string().describe("Comment text (visible to customers)"),
      },
    },
    async ({ sys_id, comment }) => {
      const record = await client.updateRecord("incident", sys_id, { comments: comment });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, number: record["number"], comment_added: true }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "sn_add_incident_work_notes",
    {
      description: "Add internal work notes to an incident (not visible to customers).",
      inputSchema: {
        sys_id: z.string().describe("Incident sys_id"),
        work_notes: z.string().describe("Work notes text (internal only)"),
      },
    },
    async ({ sys_id, work_notes }) => {
      const record = await client.updateRecord("incident", sys_id, { work_notes });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, number: record["number"], work_notes_added: true }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "sn_resolve_incident",
    {
      description: "Resolve an incident in ServiceNow (set state to Resolved).",
      inputSchema: {
        sys_id: z.string().describe("Incident sys_id"),
        resolution_code: z.string().optional().describe("Resolution code (e.g. 'Solved (Permanently)', 'Solved (Work Around)')"),
        resolution_notes: z.string().optional().describe("Resolution notes explaining the fix"),
        close_code: z.string().optional().describe("Close code"),
      },
    },
    async ({ sys_id, resolution_code, resolution_notes, close_code }) => {
      const data: Record<string, unknown> = { state: "6" }; // 6 = Resolved
      if (resolution_code) data["close_code"] = resolution_code;
      if (resolution_notes) data["close_notes"] = resolution_notes;
      if (close_code) data["close_code"] = close_code;

      const record = await client.updateRecord("incident", sys_id, data);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ resolved: true, number: record["number"], state: "Resolved" }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "sn_close_incident",
    {
      description: "Close an incident in ServiceNow (set state to Closed).",
      inputSchema: {
        sys_id: z.string().describe("Incident sys_id"),
        close_code: z.string().optional().describe("Close code (e.g. 'Solved (Permanently)')"),
        close_notes: z.string().optional().describe("Close notes"),
      },
    },
    async ({ sys_id, close_code, close_notes }) => {
      const data: Record<string, unknown> = { state: "7" }; // 7 = Closed
      if (close_code) data["close_code"] = close_code;
      if (close_notes) data["close_notes"] = close_notes;

      const record = await client.updateRecord("incident", sys_id, data);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ closed: true, number: record["number"], state: "Closed" }, null, 2) }],
      };
    }
  );
}
