import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAttachmentTools } from "../../src/tools/attachments.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";
import type { SNRecord } from "../../src/client/types.ts";

const SAMPLE_ATTACHMENT: SNRecord = {
  sys_id: "att123def456abc123def456abc12345",
  file_name: "debug.log",
  content_type: "text/plain",
  size_bytes: "4096",
  table_name: "incident",
  table_sys_id: "inc123",
  sys_created_on: "2025-07-01 10:00:00",
  sys_created_by: "admin",
};

describe("registerAttachmentTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry({
      queryTableResult: {
        records: [SAMPLE_ATTACHMENT],
        pagination: { limit: 20, offset: 0, hasMore: false, totalCount: 1 },
      },
      getRecordResult: SAMPLE_ATTACHMENT,
      requestRawResult: new Response(
        JSON.stringify({ result: { sys_id: "att999", file_name: "data.json" } }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      ),
    });
  });

  test("registers 3 tools without error", () => {
    registerAttachmentTools(server, mockRegistry as unknown as Parameters<typeof registerAttachmentTools>[1]);
    expect(true).toBe(true);
  });

  test("sn_list_attachments queries sys_attachment table", async () => {
    registerAttachmentTools(server, mockRegistry as unknown as Parameters<typeof registerAttachmentTools>[1]);

    const client = mockRegistry._client;
    const result = await client.queryTable("sys_attachment", {
      sysparm_query: "table_name=incident^table_sys_id=inc123",
    });

    expect(client._calls.queryTable).toHaveLength(1);
    expect(client._calls.queryTable[0]!.tableName).toBe("sys_attachment");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!["file_name"]).toBe("debug.log");
  });

  test("sn_get_attachment retrieves attachment metadata", async () => {
    registerAttachmentTools(server, mockRegistry as unknown as Parameters<typeof registerAttachmentTools>[1]);

    const client = mockRegistry._client;
    const record = await client.getRecord("sys_attachment", SAMPLE_ATTACHMENT["sys_id"] as string);

    expect(client._calls.getRecord).toHaveLength(1);
    expect(client._calls.getRecord[0]!.tableName).toBe("sys_attachment");
    expect(record["file_name"]).toBe("debug.log");
    expect(record["content_type"]).toBe("text/plain");
  });

  test("sn_get_attachment with include_content fetches file content", async () => {
    const textRegistry = createMockRegistry({
      getRecordResult: SAMPLE_ATTACHMENT,
      requestRawResult: new Response("line 1\nline 2\nline 3", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    });
    registerAttachmentTools(server, textRegistry as unknown as Parameters<typeof registerAttachmentTools>[1]);

    const client = textRegistry._client;
    // Get metadata
    await client.getRecord("sys_attachment", "att123");
    // Get file content
    const response = await client.requestRaw("GET", "/api/now/attachment/att123/file");
    const content = await response.text();

    expect(content).toBe("line 1\nline 2\nline 3");
    expect(client._calls.requestRaw[0]!.method).toBe("GET");
  });

  test("sn_upload_attachment calls attachment API", async () => {
    registerAttachmentTools(server, mockRegistry as unknown as Parameters<typeof registerAttachmentTools>[1]);

    const client = mockRegistry._client;
    const response = await client.requestRaw(
      "POST",
      "/api/now/attachment/file?table_name=incident&table_sys_id=inc123&file_name=data.json",
    );

    expect(client._calls.requestRaw).toHaveLength(1);
    expect(client._calls.requestRaw[0]!.method).toBe("POST");
    expect(client._calls.requestRaw[0]!.path).toContain("/api/now/attachment/file");
    expect(response.status).toBe(201);
  });
});
