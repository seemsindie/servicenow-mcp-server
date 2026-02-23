import { describe, expect, test, beforeEach, afterEach, mock, type Mock } from "bun:test";
import { ServiceNowClient } from "../../src/client/index.ts";
import { NotFoundError, UnauthorizedError } from "../../src/client/errors.ts";
import { createMockAuth } from "../mocks/index.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = Mock<(...args: any[]) => any>;

describe("ServiceNowClient", () => {
  const originalFetch = globalThis.fetch;
  const instanceUrl = "https://test.service-now.com";
  let client: ServiceNowClient;

  beforeEach(() => {
    const auth = createMockAuth({ Authorization: "Basic dGVzdDp0ZXN0" });
    client = new ServiceNowClient(instanceUrl, auth);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetchOk(body: unknown, headers: Record<string, string> = {}) {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json", ...headers },
      });
    }) as unknown as typeof fetch;
  }

  function mockFetchError(status: number, body: string) {
    globalThis.fetch = mock(async () => {
      return new Response(body, { status });
    }) as unknown as typeof fetch;
  }

  // ── queryTable ──────────────────────────────────────────

  describe("queryTable", () => {
    test("sends GET to correct URL with query params", async () => {
      mockFetchOk({ result: [{ sys_id: "1" }] }, { "X-Total-Count": "1" });

      await client.queryTable("incident", {
        sysparm_query: "active=true",
        sysparm_limit: 5,
        sysparm_offset: 0,
      });

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      const url = call[0] as string;
      expect(url).toContain("/api/now/table/incident");
      expect(url).toContain("sysparm_query=active%3Dtrue");
      expect(url).toContain("sysparm_limit=5");
      expect(url).toContain("sysparm_offset=0");
    });

    test("returns records with pagination info", async () => {
      mockFetchOk({ result: [{ sys_id: "1" }, { sys_id: "2" }] }, { "X-Total-Count": "50" });

      const result = await client.queryTable("incident", {
        sysparm_limit: 10,
        sysparm_offset: 0,
      });

      expect(result.records).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(50);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.offset).toBe(0);
    });

    test("hasMore is false when at end", async () => {
      mockFetchOk({ result: [{ sys_id: "1" }] }, { "X-Total-Count": "5" });

      const result = await client.queryTable("incident", {
        sysparm_limit: 10,
        sysparm_offset: 0,
      });

      expect(result.pagination.hasMore).toBe(false);
    });

    test("handles missing X-Total-Count header", async () => {
      mockFetchOk({ result: [{ sys_id: "1" }] });

      const result = await client.queryTable("incident", { sysparm_limit: 10 });
      expect(result.pagination.totalCount).toBeUndefined();
    });

    test("includes auth headers", async () => {
      mockFetchOk({ result: [] });

      await client.queryTable("incident");

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      const init = call[1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Basic dGVzdDp0ZXN0");
      expect(headers["Accept"]).toBe("application/json");
    });
  });

  // ── getRecord ───────────────────────────────────────────

  describe("getRecord", () => {
    test("sends GET to correct URL with sys_id", async () => {
      mockFetchOk({ result: { sys_id: "abc123", number: "INC001" } });

      const record = await client.getRecord("incident", "abc123");

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      const url = call[0] as string;
      expect(url).toBe("https://test.service-now.com/api/now/table/incident/abc123");
      expect(record.sys_id).toBe("abc123");
    });

    test("includes optional params", async () => {
      mockFetchOk({ result: { sys_id: "abc123" } });

      await client.getRecord("incident", "abc123", {
        sysparm_fields: "number,state",
        sysparm_display_value: "true",
      });

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      const url = call[0] as string;
      expect(url).toContain("sysparm_fields=number%2Cstate");
      expect(url).toContain("sysparm_display_value=true");
    });
  });

  // ── createRecord ────────────────────────────────────────

  describe("createRecord", () => {
    test("sends POST with JSON body", async () => {
      mockFetchOk({ result: { sys_id: "new123", number: "INC002" } });

      const record = await client.createRecord("incident", { short_description: "Test" });

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      const url = call[0] as string;
      const init = call[1] as RequestInit;
      expect(url).toBe("https://test.service-now.com/api/now/table/incident");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ short_description: "Test" });
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      expect(record.sys_id).toBe("new123");
    });
  });

  // ── updateRecord ────────────────────────────────────────

  describe("updateRecord", () => {
    test("sends PATCH with JSON body", async () => {
      mockFetchOk({ result: { sys_id: "abc123", state: "2" } });

      const record = await client.updateRecord("incident", "abc123", { state: "2" });

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      const url = call[0] as string;
      const init = call[1] as RequestInit;
      expect(url).toBe("https://test.service-now.com/api/now/table/incident/abc123");
      expect(init.method).toBe("PATCH");
      expect(record.state).toBe("2");
    });
  });

  // ── deleteRecord ────────────────────────────────────────

  describe("deleteRecord", () => {
    test("sends DELETE to correct URL", async () => {
      globalThis.fetch = mock(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;

      await client.deleteRecord("incident", "abc123");

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      const url = call[0] as string;
      const init = call[1] as RequestInit;
      expect(url).toBe("https://test.service-now.com/api/now/table/incident/abc123");
      expect(init.method).toBe("DELETE");
    });
  });

  // ── requestRaw ──────────────────────────────────────────

  describe("requestRaw", () => {
    test("sends request to custom API path", async () => {
      mockFetchOk({ result: { data: "custom" } });

      const response = await client.requestRaw("GET", "/api/sn_sc/servicecatalog/items");

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      const url = call[0] as string;
      expect(url).toBe("https://test.service-now.com/api/sn_sc/servicecatalog/items");
      expect(response.ok).toBe(true);
    });

    test("handles absolute URLs", async () => {
      mockFetchOk({ result: {} });

      await client.requestRaw("GET", "https://other.service-now.com/api/test");

      const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
      expect(call[0]).toBe("https://other.service-now.com/api/test");
    });
  });

  // ── Error handling ──────────────────────────────────────

  describe("error handling", () => {
    test("throws NotFoundError on 404", async () => {
      mockFetchError(404, JSON.stringify({ error: { message: "Record not found" } }));

      await expect(client.getRecord("incident", "nonexistent")).rejects.toThrow(NotFoundError);
    });

    test("throws UnauthorizedError on 401", async () => {
      mockFetchError(401, "User Not Authenticated");

      await expect(client.queryTable("incident")).rejects.toThrow(UnauthorizedError);
    });
  });
});
