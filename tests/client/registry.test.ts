import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test";
import { InstanceRegistry } from "../../src/client/registry.ts";
import type { InstanceConfig } from "../../src/config.ts";

describe("InstanceRegistry", () => {
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Suppress logger output during tests
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  function makeInstance(overrides: Partial<InstanceConfig> = {}): InstanceConfig {
    return {
      name: "dev",
      url: "https://dev.service-now.com",
      auth: { type: "basic", username: "admin", password: "pass" },
      default: false,
      ...overrides,
    };
  }

  test("creates registry with a single instance", () => {
    const registry = new InstanceRegistry([makeInstance({ default: true })]);
    expect(registry.size).toBe(1);
  });

  test("creates registry with multiple instances", () => {
    const registry = new InstanceRegistry([
      makeInstance({ name: "dev", default: true }),
      makeInstance({ name: "test", url: "https://test.service-now.com" }),
      makeInstance({ name: "prod", url: "https://prod.service-now.com" }),
    ]);
    expect(registry.size).toBe(3);
  });

  test("uses explicit default instance", () => {
    const registry = new InstanceRegistry([
      makeInstance({ name: "dev", default: false }),
      makeInstance({ name: "prod", url: "https://prod.service-now.com", default: true }),
    ]);
    expect(registry.getDefaultName()).toBe("prod");
  });

  test("uses first instance as default when none marked", () => {
    const registry = new InstanceRegistry([
      makeInstance({ name: "dev", default: false }),
      makeInstance({ name: "prod", url: "https://prod.service-now.com", default: false }),
    ]);
    expect(registry.getDefaultName()).toBe("dev");
  });

  test("resolve() returns default client when no name given", () => {
    const registry = new InstanceRegistry([makeInstance({ name: "dev", default: true })]);
    const client = registry.resolve();
    expect(client).toBeDefined();
  });

  test("resolve() returns default client for empty string", () => {
    const registry = new InstanceRegistry([makeInstance({ name: "dev", default: true })]);
    const client = registry.resolve("");
    expect(client).toBeDefined();
  });

  test("resolve() returns correct client by name", () => {
    const registry = new InstanceRegistry([
      makeInstance({ name: "dev", default: true }),
      makeInstance({ name: "prod", url: "https://prod.service-now.com" }),
    ]);
    // Should not throw for known instances
    expect(() => registry.resolve("dev")).not.toThrow();
    expect(() => registry.resolve("prod")).not.toThrow();
  });

  test("resolve() throws for unknown instance", () => {
    const registry = new InstanceRegistry([makeInstance({ name: "dev", default: true })]);
    expect(() => registry.resolve("nonexistent")).toThrow("Unknown ServiceNow instance");
    expect(() => registry.resolve("nonexistent")).toThrow("nonexistent");
  });

  test("resolve() error message lists available instances", () => {
    const registry = new InstanceRegistry([
      makeInstance({ name: "dev", default: true }),
      makeInstance({ name: "prod", url: "https://prod.service-now.com" }),
    ]);
    try {
      registry.resolve("staging");
      expect(true).toBe(false); // should not reach here
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).toContain("dev");
      expect(msg).toContain("prod");
    }
  });

  test("throws on duplicate instance names", () => {
    expect(() => new InstanceRegistry([
      makeInstance({ name: "dev", default: true }),
      makeInstance({ name: "dev" }),
    ])).toThrow("Duplicate instance name");
  });

  test("listInstances returns all instance metadata", () => {
    const registry = new InstanceRegistry([
      makeInstance({ name: "dev", default: true, description: "Development" }),
      makeInstance({ name: "prod", url: "https://prod.service-now.com" }),
    ]);
    const instances = registry.listInstances();
    expect(instances).toHaveLength(2);
    expect(instances[0]!.name).toBe("dev");
    expect(instances[0]!.isDefault).toBe(true);
    expect(instances[0]!.description).toBe("Development");
    expect(instances[1]!.name).toBe("prod");
    expect(instances[1]!.isDefault).toBe(false);
  });

  test("getInstanceInfo returns info for named instance", () => {
    const registry = new InstanceRegistry([
      makeInstance({ name: "dev", default: true }),
      makeInstance({ name: "prod", url: "https://prod.service-now.com" }),
    ]);
    const info = registry.getInstanceInfo("prod");
    expect(info.name).toBe("prod");
    expect(info.url).toBe("https://prod.service-now.com");
    expect(info.isDefault).toBe(false);
  });

  test("getInstanceInfo returns default when no name given", () => {
    const registry = new InstanceRegistry([
      makeInstance({ name: "dev", default: true }),
      makeInstance({ name: "prod", url: "https://prod.service-now.com" }),
    ]);
    const info = registry.getInstanceInfo();
    expect(info.name).toBe("dev");
    expect(info.isDefault).toBe(true);
  });

  test("getInstanceInfo throws for unknown instance", () => {
    const registry = new InstanceRegistry([makeInstance({ name: "dev", default: true })]);
    expect(() => registry.getInstanceInfo("nonexistent")).toThrow("Unknown ServiceNow instance");
  });
});
