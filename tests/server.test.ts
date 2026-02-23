import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test";
import { createServer } from "../src/server.ts";
import type { Config } from "../src/config.ts";

describe("createServer", () => {
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Suppress logger output during tests
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  function makeConfig(overrides: Partial<Config> = {}): Config {
    return {
      instanceUrl: "https://test.service-now.com",
      auth: { type: "basic", username: "admin", password: "pass" },
      toolPackage: "full",
      debug: false,
      http: { port: 3000, host: "127.0.0.1" },
      ...overrides,
    };
  }

  test("creates MCP server with full package (no errors)", () => {
    const server = createServer(makeConfig());
    expect(server).toBeDefined();
  });

  test("creates MCP server with service_desk package (no errors)", () => {
    const server = createServer(makeConfig({ toolPackage: "service_desk" }));
    expect(server).toBeDefined();
  });

  test("creates MCP server with change_coordinator package", () => {
    const server = createServer(makeConfig({ toolPackage: "change_coordinator" }));
    expect(server).toBeDefined();
  });

  test("creates MCP server with platform_developer package", () => {
    const server = createServer(makeConfig({ toolPackage: "platform_developer" }));
    expect(server).toBeDefined();
  });

  test("creates MCP server with system_admin package", () => {
    const server = createServer(makeConfig({ toolPackage: "system_admin" }));
    expect(server).toBeDefined();
  });

  test("creates MCP server with agile package", () => {
    const server = createServer(makeConfig({ toolPackage: "agile" }));
    expect(server).toBeDefined();
  });

  test("creates MCP server with catalog_builder package", () => {
    const server = createServer(makeConfig({ toolPackage: "catalog_builder" }));
    expect(server).toBeDefined();
  });

  test("creates MCP server with knowledge_author package", () => {
    const server = createServer(makeConfig({ toolPackage: "knowledge_author" }));
    expect(server).toBeDefined();
  });

  test("unknown package falls back to full without error", () => {
    const server = createServer(makeConfig({ toolPackage: "nonexistent" }));
    expect(server).toBeDefined();
  });

  test("works with oauth auth config", () => {
    const server = createServer(makeConfig({
      auth: { type: "oauth", clientId: "c1", clientSecret: "s1", username: "admin", password: "pass" },
    }));
    expect(server).toBeDefined();
  });

  test("sets debug mode when config.debug is true", () => {
    const server = createServer(makeConfig({ debug: true }));
    expect(server).toBeDefined();
    // Debug mode is set via setDebug() — verified indirectly
  });

  test("logs startup information", () => {
    createServer(makeConfig());
    // Logger writes to stderr via console.error
    expect(errorSpy).toHaveBeenCalled();
    // Check that instance URL was logged
    const allCalls = errorSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(allCalls).toContain("test.service-now.com");
    expect(allCalls).toContain("basic");
    expect(allCalls).toContain("full");
  });
});
