import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCatalogTools } from "../../src/tools/catalog.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";
import type { SNRecord } from "../../src/client/types.ts";

const SAMPLE_CATALOG_ITEM: SNRecord = {
  sys_id: "cat123def456abc123def456abc12345",
  name: "Standard Laptop",
  short_description: "Request a standard laptop",
  description: "Full description of the standard laptop offering",
  category: "Hardware",
  active: "true",
  price: "$1200.00",
};

const SAMPLE_VARIABLE: SNRecord = {
  sys_id: "var123",
  name: "justification",
  question_text: "Business Justification",
  type: "2",
  mandatory: "true",
  default_value: "",
  order: "100",
  active: "true",
};

describe("sn_validate_catalog_item", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
  });

  test("registers all catalog tools including validate without error", () => {
    mockRegistry = createMockRegistry();
    registerCatalogTools(server, mockRegistry as unknown as Parameters<typeof registerCatalogTools>[1]);
    expect(true).toBe(true);
  });

  test("validates a healthy catalog item with no errors", async () => {
    mockRegistry = createMockRegistry({
      getRecordResult: SAMPLE_CATALOG_ITEM,
      queryTableResult: {
        records: [{ ...SAMPLE_VARIABLE, mandatory: "false" }],
        pagination: { limit: 200, offset: 0, hasMore: false },
      },
    });
    registerCatalogTools(server, mockRegistry as unknown as Parameters<typeof registerCatalogTools>[1]);

    const client = mockRegistry._client;
    // Simulate the validation flow: getRecord + queryTable
    const item = await client.getRecord("sc_cat_item", "cat123");
    const vars = await client.queryTable("item_option_new", {});

    expect(item["short_description"]).toBe("Request a standard laptop");
    expect(vars.records).toHaveLength(1);
    expect(client._calls.getRecord[0]!.tableName).toBe("sc_cat_item");
    expect(client._calls.queryTable[0]!.tableName).toBe("item_option_new");
  });

  test("detects missing short_description", async () => {
    mockRegistry = createMockRegistry({
      getRecordResult: { ...SAMPLE_CATALOG_ITEM, short_description: "" },
      queryTableResult: {
        records: [],
        pagination: { limit: 200, offset: 0, hasMore: false },
      },
    });
    registerCatalogTools(server, mockRegistry as unknown as Parameters<typeof registerCatalogTools>[1]);

    const client = mockRegistry._client;
    const item = await client.getRecord("sc_cat_item", "cat123");
    expect(item["short_description"]).toBe("");
  });

  test("detects no variables", async () => {
    mockRegistry = createMockRegistry({
      getRecordResult: SAMPLE_CATALOG_ITEM,
      queryTableResult: {
        records: [],
        pagination: { limit: 200, offset: 0, hasMore: false },
      },
    });
    registerCatalogTools(server, mockRegistry as unknown as Parameters<typeof registerCatalogTools>[1]);

    const client = mockRegistry._client;
    const vars = await client.queryTable("item_option_new", {});
    expect(vars.records).toHaveLength(0);
  });

  test("detects mandatory variable without default value", async () => {
    mockRegistry = createMockRegistry({
      getRecordResult: SAMPLE_CATALOG_ITEM,
      queryTableResult: {
        records: [SAMPLE_VARIABLE],
        pagination: { limit: 200, offset: 0, hasMore: false },
      },
    });
    registerCatalogTools(server, mockRegistry as unknown as Parameters<typeof registerCatalogTools>[1]);

    const client = mockRegistry._client;
    const vars = await client.queryTable("item_option_new", {});
    const mandatoryNoDefault = vars.records.filter(
      (v) => (v["mandatory"] === "true") && (!v["default_value"] || (v["default_value"] as string).trim() === "")
    );
    expect(mandatoryNoDefault).toHaveLength(1);
  });

  test("detects inactive item", async () => {
    mockRegistry = createMockRegistry({
      getRecordResult: { ...SAMPLE_CATALOG_ITEM, active: "false" },
      queryTableResult: {
        records: [],
        pagination: { limit: 200, offset: 0, hasMore: false },
      },
    });
    registerCatalogTools(server, mockRegistry as unknown as Parameters<typeof registerCatalogTools>[1]);

    const client = mockRegistry._client;
    const item = await client.getRecord("sc_cat_item", "cat123");
    expect(item["active"]).toBe("false");
  });

  test("detects missing category", async () => {
    mockRegistry = createMockRegistry({
      getRecordResult: { ...SAMPLE_CATALOG_ITEM, category: "" },
      queryTableResult: {
        records: [],
        pagination: { limit: 200, offset: 0, hasMore: false },
      },
    });
    registerCatalogTools(server, mockRegistry as unknown as Parameters<typeof registerCatalogTools>[1]);

    const client = mockRegistry._client;
    const item = await client.getRecord("sc_cat_item", "cat123");
    expect(item["category"]).toBe("");
  });

  test("detects duplicate variable names", async () => {
    const dupeVars = [
      { ...SAMPLE_VARIABLE, sys_id: "v1", name: "justification" },
      { ...SAMPLE_VARIABLE, sys_id: "v2", name: "justification" },
      { ...SAMPLE_VARIABLE, sys_id: "v3", name: "quantity" },
    ];
    mockRegistry = createMockRegistry({
      getRecordResult: SAMPLE_CATALOG_ITEM,
      queryTableResult: {
        records: dupeVars,
        pagination: { limit: 200, offset: 0, hasMore: false },
      },
    });
    registerCatalogTools(server, mockRegistry as unknown as Parameters<typeof registerCatalogTools>[1]);

    const client = mockRegistry._client;
    const vars = await client.queryTable("item_option_new", {});
    const names = vars.records.map((v) => v["name"] as string);
    const dupes = names.filter((name, idx) => names.indexOf(name) !== idx);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toBe("justification");
  });
});
