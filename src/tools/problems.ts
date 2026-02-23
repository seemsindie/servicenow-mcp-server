import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";
import {
  resolveOptionalUser,
  resolveOptionalGroup,
  resolveRecordIdentifier,
  type ResolvableClient,
} from "../utils/resolve.ts";

export function registerProblemTools(server: McpServer, registry: InstanceRegistry): void {

  // ── List Problems ───────────────────────────────────────

  server.registerTool(
    "sn_list_problems",
    {
      description: "List problems from ServiceNow with optional filters. Returns number, description, state, priority, assignment info, known_error flag.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        query: z.string().optional().describe("Encoded query (e.g. 'active=true^priority=1')"),
        state: z.string().optional().describe("Filter by state: 101=New, 102=Assess, 103=Root Cause Analysis, 104=Fix in Progress, 106=Resolved, 107=Closed"),
        priority: z.string().optional().describe("Filter by priority: 1=Critical, 2=High, 3=Moderate, 4=Low, 5=Planning"),
        assignment_group: z.string().optional().describe("Filter by assignment group name or sys_id"),
        assigned_to: z.string().optional().describe("Filter by assigned user name or sys_id"),
        category: z.string().optional().describe("Filter by category"),
        known_error: z.boolean().optional().describe("Filter by known error flag (true/false)"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ instance, query, state, priority, assignment_group, assigned_to, category, known_error, limit, offset }) => {
      const client = registry.resolve(instance);
      const parts: string[] = [];
      if (query) parts.push(query);
      if (state) parts.push(`state=${state}`);
      if (priority) parts.push(`priority=${priority}`);
      if (assignment_group) parts.push(`assignment_group.name=${assignment_group}`);
      if (assigned_to) parts.push(`assigned_to.user_name=${assigned_to}`);
      if (category) parts.push(`category=${category}`);
      if (known_error !== undefined) parts.push(`known_error=${known_error}`);

      const encodedQuery = joinQueries(...parts, "ORDERBYDESCsys_created_on");

      const result = await client.queryTable("problem", {
        sysparm_query: encodedQuery,
        sysparm_fields: "number,short_description,state,priority,urgency,impact,category,subcategory,assigned_to,assignment_group,opened_at,known_error,workaround,cause_notes,fix_notes,sys_id",
        sysparm_limit: limit,
        sysparm_offset: offset,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, problems: result.records }, null, 2) }],
      };
    }
  );

  // ── Get Problem ─────────────────────────────────────────

  server.registerTool(
    "sn_get_problem",
    {
      description: "Get a single problem by sys_id or number (e.g. 'PRB0040001'). Returns full record details including workaround, root cause, and fix notes.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Problem sys_id or number (e.g. 'PRB0040001' — auto-resolved)"),
      },
    },
    async ({ instance, sys_id }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;
      const resolved = await resolveRecordIdentifier(rc, sys_id, "problem");

      const record = await client.getRecord("problem", resolved.sys_id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }],
      };
    }
  );

  // ── Create Problem ──────────────────────────────────────

  server.registerTool(
    "sn_create_problem",
    {
      description: "Create a new problem in ServiceNow. Accepts human-readable names for assigned_to (user name, user_name, or email) and assignment_group (group name). These are auto-resolved to sys_ids.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        short_description: z.string().describe("Brief description of the problem"),
        description: z.string().optional().describe("Detailed description"),
        urgency: z.enum(["1", "2", "3"]).optional().describe("1=High, 2=Medium, 3=Low"),
        impact: z.enum(["1", "2", "3"]).optional().describe("1=High, 2=Medium, 3=Low"),
        category: z.string().optional(),
        subcategory: z.string().optional(),
        assignment_group: z.string().optional().describe("Assignment group sys_id or group name (auto-resolved)"),
        assigned_to: z.string().optional().describe("Assigned user sys_id, user_name, email, or full name (auto-resolved)"),
        known_error: z.boolean().optional().describe("Mark as known error"),
        workaround: z.string().optional().describe("Workaround description"),
      },
    },
    async (params) => {
      const client = registry.resolve(params.instance);
      const rc = client as unknown as ResolvableClient;

      const data: Record<string, unknown> = { short_description: params.short_description };
      if (params.description) data["description"] = params.description;
      if (params.urgency) data["urgency"] = params.urgency;
      if (params.impact) data["impact"] = params.impact;
      if (params.category) data["category"] = params.category;
      if (params.subcategory) data["subcategory"] = params.subcategory;
      if (params.known_error !== undefined) data["known_error"] = params.known_error;
      if (params.workaround) data["workaround"] = params.workaround;

      // Resolve human-readable identifiers to sys_ids
      const [assignedTo, assignmentGroup] = await Promise.all([
        resolveOptionalUser(rc, params.assigned_to),
        resolveOptionalGroup(rc, params.assignment_group),
      ]);
      if (assignedTo) data["assigned_to"] = assignedTo;
      if (assignmentGroup) data["assignment_group"] = assignmentGroup;

      const record = await client.createRecord("problem", data);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ created: true, number: record["number"], sys_id: record["sys_id"], record }, null, 2) }],
      };
    }
  );

  // ── Update Problem ──────────────────────────────────────

  server.registerTool(
    "sn_update_problem",
    {
      description: "Update an existing problem in ServiceNow. The problem can be specified by sys_id or number (e.g. 'PRB0040001'). Fields like assigned_to accept human-readable names (auto-resolved).",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Problem sys_id or number (e.g. 'PRB0040001' — auto-resolved)"),
        data: z.record(z.string(), z.unknown()).describe("Fields to update. User fields (assigned_to) accept names/user_names. Group fields (assignment_group) accept group names."),
      },
    },
    async ({ instance, sys_id, data }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;

      // Resolve problem identifier (sys_id or PRB number)
      const resolved = await resolveRecordIdentifier(rc, sys_id, "problem");

      // Resolve user/group fields in data if present
      const resolvedData = { ...data };
      if (typeof resolvedData["assigned_to"] === "string") {
        resolvedData["assigned_to"] = await resolveOptionalUser(rc, resolvedData["assigned_to"] as string);
      }
      if (typeof resolvedData["assignment_group"] === "string") {
        resolvedData["assignment_group"] = await resolveOptionalGroup(rc, resolvedData["assignment_group"] as string);
      }

      const record = await client.updateRecord("problem", resolved.sys_id, resolvedData);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ updated: true, number: record["number"], sys_id: record["sys_id"], record }, null, 2) }],
      };
    }
  );

  // ── Add Comment ─────────────────────────────────────────

  server.registerTool(
    "sn_add_problem_comment",
    {
      description: "Add a customer-visible comment to a problem. Accepts problem number (e.g. 'PRB0040001') or sys_id.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Problem sys_id or number (e.g. 'PRB0040001' — auto-resolved)"),
        comment: z.string().describe("Comment text (visible to customers)"),
      },
    },
    async ({ instance, sys_id, comment }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;
      const resolved = await resolveRecordIdentifier(rc, sys_id, "problem");
      const record = await client.updateRecord("problem", resolved.sys_id, { comments: comment });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, number: record["number"], comment_added: true }, null, 2) }],
      };
    }
  );

  // ── Add Work Notes ──────────────────────────────────────

  server.registerTool(
    "sn_add_problem_work_notes",
    {
      description: "Add internal work notes to a problem (not visible to customers). Accepts problem number (e.g. 'PRB0040001') or sys_id.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Problem sys_id or number (e.g. 'PRB0040001' — auto-resolved)"),
        work_notes: z.string().describe("Work notes text (internal only)"),
      },
    },
    async ({ instance, sys_id, work_notes }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;
      const resolved = await resolveRecordIdentifier(rc, sys_id, "problem");
      const record = await client.updateRecord("problem", resolved.sys_id, { work_notes });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, number: record["number"], work_notes_added: true }, null, 2) }],
      };
    }
  );

  // ── Close Problem ───────────────────────────────────────

  server.registerTool(
    "sn_close_problem",
    {
      description: "Close a problem in ServiceNow (set state to Closed/Resolved). Accepts problem number (e.g. 'PRB0040001') or sys_id. Optionally provide root cause, fix notes, and close code.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Problem sys_id or number (e.g. 'PRB0040001' — auto-resolved)"),
        cause_notes: z.string().optional().describe("Root cause analysis notes"),
        fix_notes: z.string().optional().describe("Description of the fix applied"),
        close_code: z.string().optional().describe("Close code (e.g. 'Fix Applied', 'Risk Accepted', 'Duplicate')"),
        close_notes: z.string().optional().describe("Close notes"),
      },
    },
    async ({ instance, sys_id, cause_notes, fix_notes, close_code, close_notes }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;
      const resolved = await resolveRecordIdentifier(rc, sys_id, "problem");

      const data: Record<string, unknown> = { state: "107" }; // 107 = Closed
      if (cause_notes) data["cause_notes"] = cause_notes;
      if (fix_notes) data["fix_notes"] = fix_notes;
      if (close_code) data["close_code"] = close_code;
      if (close_notes) data["close_notes"] = close_notes;

      const record = await client.updateRecord("problem", resolved.sys_id, data);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ closed: true, number: record["number"], state: "Closed" }, null, 2) }],
      };
    }
  );
}
