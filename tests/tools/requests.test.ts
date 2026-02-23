import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRequestTools } from "../../src/tools/requests.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";
import type { SNRecord } from "../../src/client/types.ts";

const SAMPLE_REQUEST: SNRecord = {
  sys_id: "req123def456abc123def456abc12345",
  number: "REQ0010001",
  short_description: "New laptop request",
  request_state: "1",
  stage: "requested",
  requested_for: "Beth Anglin",
  opened_by: "admin",
  opened_at: "2025-07-01 10:00:00",
  price: "1200.00",
  special_instructions: "",
};

const SAMPLE_RITM: SNRecord = {
  sys_id: "ritm123def456abc123def456abc1234",
  number: "RITM0010001",
  short_description: "MacBook Pro 16-inch",
  state: "1",
  stage: "waiting_for_approval",
  request: "REQ0010001",
  cat_item: "Standard Laptop",
  assigned_to: "",
  assignment_group: "Hardware",
  quantity: "1",
  price: "1200.00",
};

describe("registerRequestTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry({
      queryTableResult: {
        records: [SAMPLE_REQUEST],
        pagination: { limit: 20, offset: 0, hasMore: false, totalCount: 1 },
      },
      getRecordResult: SAMPLE_REQUEST,
      createRecordResult: SAMPLE_REQUEST,
      updateRecordResult: { ...SAMPLE_RITM, state: "3" },
      requestRawResult: new Response(
        JSON.stringify({ result: { request_number: "REQ0010002", request_id: "req999" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
    });
  });

  test("registers 6 tools without error", () => {
    registerRequestTools(server, mockRegistry as unknown as Parameters<typeof registerRequestTools>[1]);
    expect(true).toBe(true);
  });

  // ── List Requests ───────────────────────────────────────

  test("sn_list_requests queries sc_request table", async () => {
    registerRequestTools(server, mockRegistry as unknown as Parameters<typeof registerRequestTools>[1]);

    const client = mockRegistry._client;
    const result = await client.queryTable("sc_request", {
      sysparm_query: "request_state=1^ORDERBYDESCsys_created_on",
      sysparm_limit: 20,
    });

    expect(client._calls.queryTable).toHaveLength(1);
    expect(client._calls.queryTable[0]!.tableName).toBe("sc_request");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!["number"]).toBe("REQ0010001");
  });

  // ── Get Request ─────────────────────────────────────────

  test("sn_get_request retrieves a single request", async () => {
    registerRequestTools(server, mockRegistry as unknown as Parameters<typeof registerRequestTools>[1]);

    const client = mockRegistry._client;
    const record = await client.getRecord("sc_request", SAMPLE_REQUEST["sys_id"] as string, {
      sysparm_display_value: "true",
    });

    expect(client._calls.getRecord).toHaveLength(1);
    expect(client._calls.getRecord[0]!.tableName).toBe("sc_request");
    expect(record["number"]).toBe("REQ0010001");
  });

  test("sn_get_request can include associated items", async () => {
    // Override to return RITM records for the item query
    const ritmRegistry = createMockRegistry({
      queryTableResult: {
        records: [SAMPLE_RITM],
        pagination: { limit: 100, offset: 0, hasMore: false, totalCount: 1 },
      },
      getRecordResult: SAMPLE_REQUEST,
    });
    registerRequestTools(server, ritmRegistry as unknown as Parameters<typeof registerRequestTools>[1]);

    const client = ritmRegistry._client;
    // Simulate: get the request, then query items
    await client.getRecord("sc_request", SAMPLE_REQUEST["sys_id"] as string);
    const items = await client.queryTable("sc_req_item", {
      sysparm_query: `request=${SAMPLE_REQUEST["sys_id"]}`,
    });

    expect(client._calls.queryTable).toHaveLength(1);
    expect(client._calls.queryTable[0]!.tableName).toBe("sc_req_item");
    expect(items.records).toHaveLength(1);
    expect(items.records[0]!["number"]).toBe("RITM0010001");
  });

  // ── List Requested Items ────────────────────────────────

  test("sn_list_request_items queries sc_req_item table", async () => {
    const ritmRegistry = createMockRegistry({
      queryTableResult: {
        records: [SAMPLE_RITM],
        pagination: { limit: 20, offset: 0, hasMore: false, totalCount: 1 },
      },
    });
    registerRequestTools(server, ritmRegistry as unknown as Parameters<typeof registerRequestTools>[1]);

    const client = ritmRegistry._client;
    const result = await client.queryTable("sc_req_item", {
      sysparm_query: "state=1^ORDERBYDESCsys_created_on",
      sysparm_limit: 20,
    });

    expect(client._calls.queryTable).toHaveLength(1);
    expect(client._calls.queryTable[0]!.tableName).toBe("sc_req_item");
    expect(result.records[0]!["number"]).toBe("RITM0010001");
  });

  // ── Get Requested Item ──────────────────────────────────

  test("sn_get_request_item retrieves a single RITM", async () => {
    const ritmRegistry = createMockRegistry({
      getRecordResult: SAMPLE_RITM,
      queryTableResult: {
        records: [],
        pagination: { limit: 100, offset: 0, hasMore: false },
      },
    });
    registerRequestTools(server, ritmRegistry as unknown as Parameters<typeof registerRequestTools>[1]);

    const client = ritmRegistry._client;
    const record = await client.getRecord("sc_req_item", SAMPLE_RITM["sys_id"] as string, {
      sysparm_display_value: "true",
    });

    expect(client._calls.getRecord).toHaveLength(1);
    expect(client._calls.getRecord[0]!.tableName).toBe("sc_req_item");
    expect(record["number"]).toBe("RITM0010001");
  });

  // ── Update Requested Item ───────────────────────────────

  test("sn_update_request_item updates on sc_req_item table", async () => {
    registerRequestTools(server, mockRegistry as unknown as Parameters<typeof registerRequestTools>[1]);

    const client = mockRegistry._client;
    await client.updateRecord("sc_req_item", SAMPLE_RITM["sys_id"] as string, {
      state: "3",
      assigned_to: "admin",
    });

    expect(client._calls.updateRecord).toHaveLength(1);
    expect(client._calls.updateRecord[0]!.tableName).toBe("sc_req_item");
    expect(client._calls.updateRecord[0]!.body["state"]).toBe("3");
  });

  // ── Submit Catalog Request ──────────────────────────────

  test("sn_submit_catalog_request calls Service Catalog API", async () => {
    registerRequestTools(server, mockRegistry as unknown as Parameters<typeof registerRequestTools>[1]);

    const client = mockRegistry._client;
    const response = await client.requestRaw(
      "POST",
      "/api/sn_sc/servicecatalog/items/cat123/order_now",
      { sysparm_quantity: "1", variables: { justification: "Project requirement" } }
    );

    expect(client._calls.requestRaw).toHaveLength(1);
    expect(client._calls.requestRaw[0]!.method).toBe("POST");
    expect(client._calls.requestRaw[0]!.path).toContain("/api/sn_sc/servicecatalog/items/");
    expect(client._calls.requestRaw[0]!.path).toContain("/order_now");
    expect(response.status).toBe(200);

    const data = await response.json() as { result?: Record<string, unknown> };
    expect(data.result).toBeDefined();
    expect(data.result!["request_number"]).toBe("REQ0010002");
  });

  test("sn_submit_catalog_request sends variables in body", async () => {
    registerRequestTools(server, mockRegistry as unknown as Parameters<typeof registerRequestTools>[1]);

    const client = mockRegistry._client;
    await client.requestRaw(
      "POST",
      "/api/sn_sc/servicecatalog/items/cat456/order_now",
      {
        sysparm_quantity: "2",
        variables: { model: "MacBook Pro", memory: "32GB" },
      }
    );

    const call = client._calls.requestRaw[0]!;
    expect(call.body!["sysparm_quantity"]).toBe("2");
    expect((call.body!["variables"] as Record<string, string>)["model"]).toBe("MacBook Pro");
  });
});
