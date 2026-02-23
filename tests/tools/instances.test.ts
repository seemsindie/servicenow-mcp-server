import { describe, expect, test, beforeEach } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerInstanceTools } from "../../src/tools/instances.ts";
import { createMockRegistry, type MockRegistry } from "../mocks/index.ts";

describe("registerInstanceTools", () => {
  let server: McpServer;
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    mockRegistry = createMockRegistry({}, {
      defaultName: "dev",
      instances: [
        { name: "dev", url: "https://dev.service-now.com", isDefault: true, description: "Development" },
        { name: "prod", url: "https://prod.service-now.com", isDefault: false },
      ],
    });
  });

  test("registers 2 tools without error", () => {
    registerInstanceTools(server, mockRegistry as unknown as Parameters<typeof registerInstanceTools>[1]);
    expect(true).toBe(true);
  });

  test("mock registry lists configured instances", () => {
    const instances = mockRegistry.listInstances();
    expect(instances).toHaveLength(2);
    expect(instances[0]!.name).toBe("dev");
    expect(instances[0]!.isDefault).toBe(true);
    expect(instances[1]!.name).toBe("prod");
  });

  test("mock registry returns default instance name", () => {
    expect(mockRegistry.getDefaultName()).toBe("dev");
  });

  test("mock registry getInstanceInfo returns correct instance", () => {
    const info = mockRegistry.getInstanceInfo("dev");
    expect(info.name).toBe("dev");
    expect(info.url).toBe("https://dev.service-now.com");
    expect(info.description).toBe("Development");
  });

  test("mock registry getInstanceInfo returns default when no name given", () => {
    const info = mockRegistry.getInstanceInfo();
    expect(info.name).toBe("dev");
  });

  test("mock registry getInstanceInfo throws for unknown instance", () => {
    expect(() => mockRegistry.getInstanceInfo("nonexistent")).toThrow("Unknown instance");
  });
});
