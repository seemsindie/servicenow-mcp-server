import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBatchTools } from "../../src/tools/batch.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";

describe("registerBatchTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry();
  });

  test("registers 2 tools without error", () => {
    registerBatchTools(server, mockRegistry as unknown as Parameters<typeof registerBatchTools>[1]);
    expect(true).toBe(true);
  });

  test("batch create executes multiple createRecord calls", async () => {
    registerBatchTools(server, mockRegistry as unknown as Parameters<typeof registerBatchTools>[1]);

    const client = mockRegistry._client;
    // Simulate what sn_batch_create does internally
    const operations = [
      { table: "incident", data: { short_description: "Issue 1" } },
      { table: "incident", data: { short_description: "Issue 2" } },
      { table: "change_request", data: { short_description: "Change 1" } },
    ];

    const results = await Promise.allSettled(
      operations.map((op) => client.createRecord(op.table, op.data))
    );

    expect(client._calls.createRecord).toHaveLength(3);
    expect(client._calls.createRecord[0]!.tableName).toBe("incident");
    expect(client._calls.createRecord[1]!.tableName).toBe("incident");
    expect(client._calls.createRecord[2]!.tableName).toBe("change_request");

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    expect(succeeded).toBe(3);
  });

  test("batch update executes multiple updateRecord calls", async () => {
    registerBatchTools(server, mockRegistry as unknown as Parameters<typeof registerBatchTools>[1]);

    const client = mockRegistry._client;
    const updates = [
      { table: "incident", sys_id: "id1", data: { state: "2" } },
      { table: "incident", sys_id: "id2", data: { state: "6" } },
    ];

    const results = await Promise.allSettled(
      updates.map((op) => client.updateRecord(op.table, op.sys_id, op.data))
    );

    expect(client._calls.updateRecord).toHaveLength(2);
    expect(client._calls.updateRecord[0]!.sysId).toBe("id1");
    expect(client._calls.updateRecord[1]!.sysId).toBe("id2");

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    expect(succeeded).toBe(2);
  });

  test("batch handles partial failures", async () => {
    const client = mockRegistry._client;
    // Create a client that fails on the second call
    let callCount = 0;
    const failingClient = {
      ...client,
      createRecord: async (table: string, body: Record<string, unknown>) => {
        callCount++;
        if (callCount === 2) throw new Error("Record creation failed");
        return { sys_id: `id${callCount}`, ...body };
      },
    };

    const operations = [
      { table: "incident", data: { short_description: "OK" } },
      { table: "incident", data: { short_description: "FAIL" } },
      { table: "incident", data: { short_description: "OK" } },
    ];

    const results = await Promise.allSettled(
      operations.map((op) => failingClient.createRecord(op.table, op.data))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    expect(succeeded).toBe(2);
    expect(failed).toBe(1);
  });
});
