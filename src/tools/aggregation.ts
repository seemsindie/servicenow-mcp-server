import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";

export function registerAggregationTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool(
    "sn_aggregate_table",
    {
      description: "Run aggregate queries (COUNT, SUM, AVG, MIN, MAX) on a ServiceNow table using the Aggregate API. Supports grouping by fields. Useful for dashboards, reporting, and data analysis without fetching individual records.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        table: z.string().describe("Table name (e.g. 'incident', 'change_request')"),
        stat_type: z.enum(["COUNT", "SUM", "AVG", "MIN", "MAX"]).describe("Aggregate operation"),
        query: z.string().optional().describe("Encoded query to filter records (e.g. 'active=true^priority=1')"),
        aggregate_field: z.string().optional().describe("Field to aggregate (required for SUM, AVG, MIN, MAX). Not needed for COUNT."),
        group_by: z.string().optional().describe("Field to group results by (e.g. 'priority', 'state', 'assignment_group')"),
        having_count: z.number().int().optional().describe("Only return groups with count >= this value"),
        order_by: z.string().optional().describe("Field to order results by"),
        order_direction: z.enum(["asc", "desc"]).optional().describe("Order direction"),
      },
    },
    async ({ instance, table, stat_type, query, aggregate_field, group_by, having_count, order_by, order_direction }) => {
      const client = registry.resolve(instance);

      const params = new URLSearchParams();
      params.set("sysparm_count", "true");

      if (query) params.set("sysparm_query", query);
      if (group_by) params.set("sysparm_group_by", group_by);
      if (aggregate_field) {
        const paramName = `sysparm_${stat_type.toLowerCase()}_fields`;
        params.set(paramName, aggregate_field);
      }
      if (having_count !== undefined) params.set("sysparm_having_count", String(having_count));
      if (order_by) {
        const dir = order_direction === "desc" ? "DESC" : "ASC";
        params.set("sysparm_orderby", `${dir}${order_by}`);
      }
      params.set("sysparm_display_value", "true");

      const response = await client.requestRaw("GET", `/api/now/stats/${table}?${params.toString()}`);
      const data = await response.json() as { result: unknown };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ table, stat_type, result: data.result }, null, 2),
        }],
      };
    }
  );
}
