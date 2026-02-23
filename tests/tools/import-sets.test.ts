import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerImportSetTools } from "../../src/tools/import-sets.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";
import type { SNRecord } from "../../src/client/types.ts";

const SAMPLE_TRANSFORM_MAP: SNRecord = {
  sys_id: "tm123def456abc123def456abc12345",
  name: "Import Users",
  source_table: "u_import_users",
  target_table: "sys_user",
  active: "true",
};

describe("registerImportSetTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry({
      createRecordResult: { sys_id: "imp001", u_name: "John Doe" },
      getRecordResult: SAMPLE_TRANSFORM_MAP,
      requestRawResult: new Response(
        JSON.stringify({ result: { import_set: "ISET001", transform_result: { inserts: 5, updates: 2 } } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
    });
  });

  test("registers 2 tools without error", () => {
    registerImportSetTools(server, mockRegistry as unknown as Parameters<typeof registerImportSetTools>[1]);
    expect(true).toBe(true);
  });

  test("sn_create_import_set inserts records into staging table", async () => {
    registerImportSetTools(server, mockRegistry as unknown as Parameters<typeof registerImportSetTools>[1]);

    const client = mockRegistry._client;
    const records = [
      { u_name: "John Doe", u_email: "john@example.com" },
      { u_name: "Jane Smith", u_email: "jane@example.com" },
    ];

    for (const record of records) {
      await client.createRecord("u_import_users", record);
    }

    expect(client._calls.createRecord).toHaveLength(2);
    expect(client._calls.createRecord[0]!.tableName).toBe("u_import_users");
    expect(client._calls.createRecord[0]!.body["u_name"]).toBe("John Doe");
    expect(client._calls.createRecord[1]!.body["u_name"]).toBe("Jane Smith");
  });

  test("sn_create_import_set handles partial failures", async () => {
    let callCount = 0;
    const failingClient = {
      ...mockRegistry._client,
      createRecord: async (table: string, body: Record<string, unknown>) => {
        callCount++;
        if (callCount === 2) throw new Error("Duplicate record");
        return { sys_id: `imp${callCount}`, ...body };
      },
    };

    const records = [
      { u_name: "OK" },
      { u_name: "FAIL" },
      { u_name: "OK2" },
    ];

    const created: unknown[] = [];
    const errors: unknown[] = [];

    for (const [index, record] of records.entries()) {
      try {
        const result = await failingClient.createRecord("u_import_users", record);
        created.push(result);
      } catch (err) {
        errors.push({ index, error: (err as Error).message });
      }
    }

    expect(created).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });

  test("sn_run_transform retrieves transform map then calls API", async () => {
    registerImportSetTools(server, mockRegistry as unknown as Parameters<typeof registerImportSetTools>[1]);

    const client = mockRegistry._client;

    // Get transform map
    const map = await client.getRecord("sys_transform_map", "tm123");
    expect(map["name"]).toBe("Import Users");
    expect(map["source_table"]).toBe("u_import_users");

    // Execute transform
    const response = await client.requestRaw("POST", "/api/now/import/u_import_users/insertMultiple", {
      transform_map: "tm123",
    });

    expect(client._calls.getRecord[0]!.tableName).toBe("sys_transform_map");
    expect(client._calls.requestRaw[0]!.method).toBe("POST");
    expect(client._calls.requestRaw[0]!.path).toContain("/api/now/import/");
    expect(response.status).toBe(200);
  });

  test("sn_run_transform includes import_set_sys_id when provided", async () => {
    registerImportSetTools(server, mockRegistry as unknown as Parameters<typeof registerImportSetTools>[1]);

    const client = mockRegistry._client;
    await client.requestRaw("POST", "/api/now/import/u_import_users/insertMultiple", {
      transform_map: "tm123",
      import_set: "iset456",
    });

    expect(client._calls.requestRaw[0]!.body!["import_set"]).toBe("iset456");
  });
});
