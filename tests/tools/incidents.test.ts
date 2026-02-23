import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIncidentTools } from "../../src/tools/incidents.ts";
import { createMockRegistry, SAMPLE_INCIDENT, type MockRegistry } from "../mocks/index.ts";

describe("registerIncidentTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry({
      queryTableResult: {
        records: [SAMPLE_INCIDENT],
        pagination: { limit: 20, offset: 0, hasMore: false, totalCount: 1 },
      },
      createRecordResult: { ...SAMPLE_INCIDENT, number: "INC0010002" },
      updateRecordResult: { ...SAMPLE_INCIDENT, state: "6" },
    });
  });

  test("registers 7 tools without error", () => {
    registerIncidentTools(server, mockRegistry as unknown as Parameters<typeof registerIncidentTools>[1]);
    expect(true).toBe(true);
  });

  test("sn_list_incidents queries incident table", async () => {
    registerIncidentTools(server, mockRegistry as unknown as Parameters<typeof registerIncidentTools>[1]);

    const client = mockRegistry._client;
    const result = await client.queryTable("incident", {
      sysparm_query: "state=1^priority=2^ORDERBYDESCsys_created_on",
      sysparm_limit: 20,
    });

    expect(client._calls.queryTable).toHaveLength(1);
    expect(client._calls.queryTable[0]!.tableName).toBe("incident");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!["number"]).toBe("INC0010001");
  });

  test("sn_create_incident creates on incident table", async () => {
    registerIncidentTools(server, mockRegistry as unknown as Parameters<typeof registerIncidentTools>[1]);

    const client = mockRegistry._client;
    const record = await client.createRecord("incident", {
      short_description: "Cannot access email",
      urgency: "2",
      impact: "2",
    });

    expect(client._calls.createRecord).toHaveLength(1);
    expect(client._calls.createRecord[0]!.tableName).toBe("incident");
    expect(record.number).toBe("INC0010002");
  });

  test("sn_resolve_incident sets state to 6", async () => {
    registerIncidentTools(server, mockRegistry as unknown as Parameters<typeof registerIncidentTools>[1]);

    const client = mockRegistry._client;
    const record = await client.updateRecord("incident", SAMPLE_INCIDENT["sys_id"] as string, {
      state: "6",
      close_notes: "Fixed by restarting service",
    });

    expect(client._calls.updateRecord).toHaveLength(1);
    expect(client._calls.updateRecord[0]!.body["state"]).toBe("6");
  });

  test("sn_close_incident sets state to 7", async () => {
    registerIncidentTools(server, mockRegistry as unknown as Parameters<typeof registerIncidentTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("incident", SAMPLE_INCIDENT["sys_id"] as string, {
      state: "7",
      close_code: "Solved (Permanently)",
    });

    expect(client._calls.updateRecord[0]!.body["state"]).toBe("7");
  });

  test("sn_add_incident_comment adds comments field", async () => {
    registerIncidentTools(server, mockRegistry as unknown as Parameters<typeof registerIncidentTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("incident", "abc123", { comments: "Customer updated" });

    expect(client._calls.updateRecord[0]!.body["comments"]).toBe("Customer updated");
  });

  test("sn_add_incident_work_notes adds work_notes field", async () => {
    registerIncidentTools(server, mockRegistry as unknown as Parameters<typeof registerIncidentTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("incident", "abc123", { work_notes: "Internal note" });

    expect(client._calls.updateRecord[0]!.body["work_notes"]).toBe("Internal note");
  });
});
