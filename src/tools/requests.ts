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

export function registerRequestTools(server: McpServer, registry: InstanceRegistry): void {

  // ── List Requests ───────────────────────────────────────

  server.registerTool(
    "sn_list_requests",
    {
      description: "List service requests (sc_request) from ServiceNow with optional filters. Returns number, description, state, requested_for, price.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        query: z.string().optional().describe("Encoded query (e.g. 'active=true')"),
        state: z.string().optional().describe("Filter by state: 1=Open, 2=Work in Progress, 3=Closed Complete, 4=Closed Incomplete, 7=Closed"),
        requested_for: z.string().optional().describe("Filter by requested_for user name, user_name, email, or sys_id"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ instance, query, state, requested_for, limit, offset }) => {
      const client = registry.resolve(instance);
      const parts: string[] = [];
      if (query) parts.push(query);
      if (state) parts.push(`request_state=${state}`);
      if (requested_for) parts.push(`requested_for.user_name=${requested_for}`);

      const encodedQuery = joinQueries(...parts, "ORDERBYDESCsys_created_on");

      const result = await client.queryTable("sc_request", {
        sysparm_query: encodedQuery,
        sysparm_fields: "number,short_description,request_state,stage,requested_for,opened_by,opened_at,price,special_instructions,sys_id",
        sysparm_limit: limit,
        sysparm_offset: offset,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, requests: result.records }, null, 2) }],
      };
    }
  );

  // ── Get Request ─────────────────────────────────────────

  server.registerTool(
    "sn_get_request",
    {
      description: "Get a single service request by sys_id or number (e.g. 'REQ0010001'). Returns full record details and associated requested items.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Request sys_id or number (e.g. 'REQ0010001' — auto-resolved)"),
        include_items: z.boolean().default(true).describe("Include associated requested items (RITMs)"),
      },
    },
    async ({ instance, sys_id, include_items }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;
      const resolved = await resolveRecordIdentifier(rc, sys_id, "sc_request");

      const record = await client.getRecord("sc_request", resolved.sys_id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      let items: unknown[] | undefined;
      if (include_items) {
        const itemResult = await client.queryTable("sc_req_item", {
          sysparm_query: `request=${resolved.sys_id}^ORDERBYnumber`,
          sysparm_fields: "number,short_description,state,stage,cat_item,assigned_to,assignment_group,quantity,price,sys_id",
          sysparm_limit: 100,
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
        });
        items = itemResult.records;
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ request: record, ...(items !== undefined ? { items, item_count: items.length } : {}) }, null, 2) }],
      };
    }
  );

  // ── List Requested Items ────────────────────────────────

  server.registerTool(
    "sn_list_request_items",
    {
      description: "List requested items (RITMs / sc_req_item) from ServiceNow with optional filters.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        query: z.string().optional().describe("Encoded query"),
        request: z.string().optional().describe("Parent request sys_id or number (e.g. 'REQ0010001' — auto-resolved)"),
        state: z.string().optional().describe("Filter by state"),
        assigned_to: z.string().optional().describe("Filter by assigned user name or sys_id"),
        assignment_group: z.string().optional().describe("Filter by assignment group name or sys_id"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ instance, query, request, state, assigned_to, assignment_group, limit, offset }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;
      const parts: string[] = [];
      if (query) parts.push(query);
      if (request) {
        const resolved = await resolveRecordIdentifier(rc, request, "sc_request");
        parts.push(`request=${resolved.sys_id}`);
      }
      if (state) parts.push(`state=${state}`);
      if (assigned_to) parts.push(`assigned_to.user_name=${assigned_to}`);
      if (assignment_group) parts.push(`assignment_group.name=${assignment_group}`);

      const encodedQuery = joinQueries(...parts, "ORDERBYDESCsys_created_on");

      const result = await client.queryTable("sc_req_item", {
        sysparm_query: encodedQuery,
        sysparm_fields: "number,short_description,state,stage,request,cat_item,assigned_to,assignment_group,quantity,price,sys_id",
        sysparm_limit: limit,
        sysparm_offset: offset,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, items: result.records }, null, 2) }],
      };
    }
  );

  // ── Get Requested Item ──────────────────────────────────

  server.registerTool(
    "sn_get_request_item",
    {
      description: "Get a single requested item (RITM) by sys_id or number (e.g. 'RITM0010001'). Returns full record details including catalog item info and variables.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Requested item sys_id or number (e.g. 'RITM0010001' — auto-resolved)"),
        include_variables: z.boolean().default(true).describe("Include catalog variables submitted with the request"),
      },
    },
    async ({ instance, sys_id, include_variables }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;
      const resolved = await resolveRecordIdentifier(rc, sys_id, "sc_req_item");

      const record = await client.getRecord("sc_req_item", resolved.sys_id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      let variables: unknown[] | undefined;
      if (include_variables) {
        const varResult = await client.queryTable("sc_item_option_mtom", {
          sysparm_query: `request_item=${resolved.sys_id}`,
          sysparm_fields: "sc_item_option.item_option_new.name,sc_item_option.item_option_new.question_text,sc_item_option.value,sys_id",
          sysparm_limit: 100,
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
        });
        variables = varResult.records;
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ item: record, ...(variables !== undefined ? { variables, variable_count: variables.length } : {}) }, null, 2) }],
      };
    }
  );

  // ── Update Requested Item ───────────────────────────────

  server.registerTool(
    "sn_update_request_item",
    {
      description: "Update a requested item (RITM) in ServiceNow. The item can be specified by sys_id or number (e.g. 'RITM0010001'). Fields like assigned_to accept human-readable names (auto-resolved).",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Requested item sys_id or number (e.g. 'RITM0010001' — auto-resolved)"),
        data: z.record(z.string(), z.unknown()).describe("Fields to update. User fields (assigned_to) accept names/user_names. Group fields (assignment_group) accept group names."),
      },
    },
    async ({ instance, sys_id, data }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;

      const resolved = await resolveRecordIdentifier(rc, sys_id, "sc_req_item");

      // Resolve user/group fields in data if present
      const resolvedData = { ...data };
      if (typeof resolvedData["assigned_to"] === "string") {
        resolvedData["assigned_to"] = await resolveOptionalUser(rc, resolvedData["assigned_to"] as string);
      }
      if (typeof resolvedData["assignment_group"] === "string") {
        resolvedData["assignment_group"] = await resolveOptionalGroup(rc, resolvedData["assignment_group"] as string);
      }

      const record = await client.updateRecord("sc_req_item", resolved.sys_id, resolvedData);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ updated: true, number: record["number"], sys_id: record["sys_id"], record }, null, 2) }],
      };
    }
  );

  // ── Submit Catalog Request ──────────────────────────────

  server.registerTool(
    "sn_submit_catalog_request",
    {
      description: "Submit a new service catalog request by ordering a catalog item. Uses the Service Catalog API to create a request with the specified item and variables. Returns the created request number and requested item details.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        catalog_item_sys_id: z.string().describe("The sys_id of the catalog item to order"),
        variables: z.record(z.string(), z.unknown()).optional().describe("Catalog variables (form field values) as key-value pairs. Keys are variable names."),
        requested_for: z.string().optional().describe("User sys_id, user_name, email, or full name to request on behalf of (auto-resolved). Defaults to the authenticated user."),
        quantity: z.number().int().min(1).default(1).describe("Quantity to order"),
      },
    },
    async ({ instance, catalog_item_sys_id, variables, requested_for, quantity }) => {
      const client = registry.resolve(instance);
      const rc = client as unknown as ResolvableClient;

      const body: Record<string, unknown> = {};
      if (variables) body["sysparm_quantity"] = String(quantity);
      if (variables) body["variables"] = variables;
      if (!variables) body["sysparm_quantity"] = String(quantity);

      if (requested_for) {
        const resolvedUser = await resolveOptionalUser(rc, requested_for);
        if (resolvedUser) body["sysparm_requested_for"] = resolvedUser;
      }

      const response = await client.requestRaw(
        "POST",
        `/api/sn_sc/servicecatalog/items/${catalog_item_sys_id}/order_now`,
        body
      );

      const data = await response.json() as { result?: Record<string, unknown> };
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ submitted: true, result: data.result ?? data }, null, 2) }],
      };
    }
  );
}
