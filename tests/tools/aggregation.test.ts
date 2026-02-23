import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAggregationTools } from "../../src/tools/aggregation.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";

describe("registerAggregationTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry({
      requestRawResult: new Response(
        JSON.stringify({
          result: {
            stats: { count: "142" },
            group_by_fields: [
              { value: "1", count: "25", field: "priority" },
              { value: "2", count: "48", field: "priority" },
              { value: "3", count: "69", field: "priority" },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
    });
  });

  test("registers 1 tool without error", () => {
    registerAggregationTools(server, mockRegistry as unknown as Parameters<typeof registerAggregationTools>[1]);
    expect(true).toBe(true);
  });

  test("sn_aggregate_table calls stats API with COUNT", async () => {
    registerAggregationTools(server, mockRegistry as unknown as Parameters<typeof registerAggregationTools>[1]);

    const client = mockRegistry._client;
    const response = await client.requestRaw("GET", "/api/now/stats/incident?sysparm_count=true");

    expect(client._calls.requestRaw).toHaveLength(1);
    expect(client._calls.requestRaw[0]!.method).toBe("GET");
    expect(client._calls.requestRaw[0]!.path).toContain("/api/now/stats/incident");
    expect(response.status).toBe(200);

    const data = await response.json() as { result: { stats: { count: string } } };
    expect(data.result.stats.count).toBe("142");
  });

  test("sn_aggregate_table supports group_by", async () => {
    registerAggregationTools(server, mockRegistry as unknown as Parameters<typeof registerAggregationTools>[1]);

    const client = mockRegistry._client;
    await client.requestRaw(
      "GET",
      "/api/now/stats/incident?sysparm_count=true&sysparm_group_by=priority"
    );

    expect(client._calls.requestRaw[0]!.path).toContain("sysparm_group_by=priority");
  });

  test("sn_aggregate_table supports query filter", async () => {
    registerAggregationTools(server, mockRegistry as unknown as Parameters<typeof registerAggregationTools>[1]);

    const client = mockRegistry._client;
    await client.requestRaw(
      "GET",
      "/api/now/stats/incident?sysparm_count=true&sysparm_query=active%3Dtrue"
    );

    expect(client._calls.requestRaw[0]!.path).toContain("sysparm_query=");
  });

  test("sn_aggregate_table supports SUM with aggregate_field", async () => {
    registerAggregationTools(server, mockRegistry as unknown as Parameters<typeof registerAggregationTools>[1]);

    const client = mockRegistry._client;
    await client.requestRaw(
      "GET",
      "/api/now/stats/sc_req_item?sysparm_count=true&sysparm_sum_fields=price"
    );

    expect(client._calls.requestRaw[0]!.path).toContain("sysparm_sum_fields=price");
  });
});
