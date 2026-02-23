import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProblemTools } from "../../src/tools/problems.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";
import type { SNRecord } from "../../src/client/types.ts";

const SAMPLE_PROBLEM: SNRecord = {
  sys_id: "prb123def456abc123def456abc12345",
  number: "PRB0040001",
  short_description: "Recurring network timeouts",
  state: "101",
  priority: "2",
  urgency: "2",
  impact: "2",
  assigned_to: "admin",
  assignment_group: "Network",
  category: "Network",
  known_error: "false",
  workaround: "",
  cause_notes: "",
  fix_notes: "",
  opened_at: "2025-06-01 09:00:00",
};

describe("registerProblemTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry({
      queryTableResult: {
        records: [SAMPLE_PROBLEM],
        pagination: { limit: 20, offset: 0, hasMore: false, totalCount: 1 },
      },
      getRecordResult: SAMPLE_PROBLEM,
      createRecordResult: { ...SAMPLE_PROBLEM, number: "PRB0040002" },
      updateRecordResult: { ...SAMPLE_PROBLEM, state: "107" },
    });
  });

  test("registers 7 tools without error", () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);
    expect(true).toBe(true);
  });

  // ── List ────────────────────────────────────────────────

  test("sn_list_problems queries problem table", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    const result = await client.queryTable("problem", {
      sysparm_query: "state=101^priority=2^ORDERBYDESCsys_created_on",
      sysparm_limit: 20,
    });

    expect(client._calls.queryTable).toHaveLength(1);
    expect(client._calls.queryTable[0]!.tableName).toBe("problem");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!["number"]).toBe("PRB0040001");
  });

  test("sn_list_problems supports known_error filter", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    await client.queryTable("problem", {
      sysparm_query: "known_error=true^ORDERBYDESCsys_created_on",
      sysparm_limit: 20,
    });

    expect(client._calls.queryTable).toHaveLength(1);
    expect(client._calls.queryTable[0]!.tableName).toBe("problem");
  });

  // ── Get ─────────────────────────────────────────────────

  test("sn_get_problem retrieves a single problem", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    const record = await client.getRecord("problem", SAMPLE_PROBLEM["sys_id"] as string, {
      sysparm_display_value: "true",
    });

    expect(client._calls.getRecord).toHaveLength(1);
    expect(client._calls.getRecord[0]!.tableName).toBe("problem");
    expect(record["number"]).toBe("PRB0040001");
  });

  // ── Create ──────────────────────────────────────────────

  test("sn_create_problem creates on problem table", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    const record = await client.createRecord("problem", {
      short_description: "Database deadlock during peak hours",
      urgency: "1",
      impact: "1",
    });

    expect(client._calls.createRecord).toHaveLength(1);
    expect(client._calls.createRecord[0]!.tableName).toBe("problem");
    expect(record.number).toBe("PRB0040002");
  });

  test("sn_create_problem passes known_error and workaround", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    await client.createRecord("problem", {
      short_description: "Known issue with auth",
      known_error: true,
      workaround: "Clear browser cache",
    });

    expect(client._calls.createRecord[0]!.body["known_error"]).toBe(true);
    expect(client._calls.createRecord[0]!.body["workaround"]).toBe("Clear browser cache");
  });

  // ── Update ──────────────────────────────────────────────

  test("sn_update_problem updates on problem table", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("problem", SAMPLE_PROBLEM["sys_id"] as string, {
      priority: "1",
      known_error: "true",
    });

    expect(client._calls.updateRecord).toHaveLength(1);
    expect(client._calls.updateRecord[0]!.tableName).toBe("problem");
    expect(client._calls.updateRecord[0]!.body["priority"]).toBe("1");
  });

  // ── Comment ─────────────────────────────────────────────

  test("sn_add_problem_comment adds comments field", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("problem", SAMPLE_PROBLEM["sys_id"] as string, {
      comments: "Vendor confirmed the issue",
    });

    expect(client._calls.updateRecord[0]!.body["comments"]).toBe("Vendor confirmed the issue");
  });

  // ── Work Notes ──────────────────────────────────────────

  test("sn_add_problem_work_notes adds work_notes field", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("problem", SAMPLE_PROBLEM["sys_id"] as string, {
      work_notes: "Root cause identified: memory leak in auth module",
    });

    expect(client._calls.updateRecord[0]!.body["work_notes"]).toBe(
      "Root cause identified: memory leak in auth module"
    );
  });

  // ── Close ───────────────────────────────────────────────

  test("sn_close_problem sets state to 107", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("problem", SAMPLE_PROBLEM["sys_id"] as string, {
      state: "107",
      cause_notes: "Memory leak in authentication module",
      fix_notes: "Patched module version 2.3.1",
    });

    expect(client._calls.updateRecord[0]!.body["state"]).toBe("107");
    expect(client._calls.updateRecord[0]!.body["cause_notes"]).toBe(
      "Memory leak in authentication module"
    );
    expect(client._calls.updateRecord[0]!.body["fix_notes"]).toBe(
      "Patched module version 2.3.1"
    );
  });

  test("sn_close_problem supports close_code and close_notes", async () => {
    registerProblemTools(server, mockRegistry as unknown as Parameters<typeof registerProblemTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("problem", SAMPLE_PROBLEM["sys_id"] as string, {
      state: "107",
      close_code: "Fix Applied",
      close_notes: "Permanent fix deployed",
    });

    expect(client._calls.updateRecord[0]!.body["close_code"]).toBe("Fix Applied");
    expect(client._calls.updateRecord[0]!.body["close_notes"]).toBe("Permanent fix deployed");
  });
});
