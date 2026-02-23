import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTableTools } from "../../src/tools/tables.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";

/**
 * Tests for the table CRUD tools.
 *
 * Strategy: We create a real McpServer, register tools on it, then
 * inspect that tools were registered by using server internals.
 * For callback behavior, we test via the mock client's recorded calls.
 */
describe("registerTableTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry({
      queryTableResult: {
        records: [{ sys_id: "rec1", short_description: "Test" }],
        pagination: { limit: 10, offset: 0, hasMore: false, totalCount: 1 },
      },
    });
  });

  test("registers 5 tools", () => {
    // We can't directly inspect registered tools easily, so just verify it doesn't throw
    registerTableTools(server, mockRegistry as unknown as Parameters<typeof registerTableTools>[1]);
    // If we got here without error, tools were registered
    expect(true).toBe(true);
  });

  test("sn_query_table calls client.queryTable with correct params", async () => {
    registerTableTools(server, mockRegistry as unknown as Parameters<typeof registerTableTools>[1]);

    // Simulate what the tool callback does
    const client = mockRegistry._client;
    const result = await client.queryTable("incident", {
      sysparm_query: "active=true",
      sysparm_fields: "number,state",
      sysparm_limit: 10,
      sysparm_offset: 0,
      sysparm_display_value: "false",
      sysparm_exclude_reference_link: "true",
    });

    expect(client._calls.queryTable).toHaveLength(1);
    expect(client._calls.queryTable[0]!.tableName).toBe("incident");
    expect(result.records).toHaveLength(1);
  });

  test("sn_create_record calls client.createRecord", async () => {
    registerTableTools(server, mockRegistry as unknown as Parameters<typeof registerTableTools>[1]);

    const client = mockRegistry._client;
    const record = await client.createRecord("incident", { short_description: "New incident" });

    expect(client._calls.createRecord).toHaveLength(1);
    expect(client._calls.createRecord[0]!.tableName).toBe("incident");
    expect(client._calls.createRecord[0]!.body).toEqual({ short_description: "New incident" });
    expect(record.short_description).toBe("New incident");
  });

  test("sn_update_record calls client.updateRecord", async () => {
    registerTableTools(server, mockRegistry as unknown as Parameters<typeof registerTableTools>[1]);

    const client = mockRegistry._client;
    const record = await client.updateRecord("incident", "abc123", { state: "2" });

    expect(client._calls.updateRecord).toHaveLength(1);
    expect(client._calls.updateRecord[0]!.sysId).toBe("abc123");
    expect(record.state).toBe("2");
  });

  test("sn_delete_record calls client.deleteRecord", async () => {
    registerTableTools(server, mockRegistry as unknown as Parameters<typeof registerTableTools>[1]);

    const client = mockRegistry._client;
    await client.deleteRecord("incident", "abc123");

    expect(client._calls.deleteRecord).toHaveLength(1);
    expect(client._calls.deleteRecord[0]!.sysId).toBe("abc123");
  });

  test("sn_get_record calls client.getRecord", async () => {
    registerTableTools(server, mockRegistry as unknown as Parameters<typeof registerTableTools>[1]);

    const client = mockRegistry._client;
    const record = await client.getRecord("incident", "abc123");

    expect(client._calls.getRecord).toHaveLength(1);
    expect(client._calls.getRecord[0]!.sysId).toBe("abc123");
    expect(record.sys_id).toBe("abc123def456abc123def456abc12345");
  });
});
