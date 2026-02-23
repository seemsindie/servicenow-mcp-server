import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test";
import { getPackageToolFilter } from "../../src/packages/index.ts";
import { TOOL_PACKAGES } from "../../src/packages/definitions.ts";

describe("getPackageToolFilter", () => {
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    warnSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("'full' returns null (load all modules)", () => {
    const result = getPackageToolFilter("full");
    expect(result).toBeNull();
  });

  test("'service_desk' returns correct module set", () => {
    const result = getPackageToolFilter("service_desk");
    expect(result).toBeInstanceOf(Set);
    expect(result!.has("tables")).toBe(true);
    expect(result!.has("incidents")).toBe(true);
    expect(result!.has("users")).toBe(true);
    expect(result!.has("knowledge")).toBe(true);
    expect(result!.has("search")).toBe(true);
    expect(result!.has("cmdb")).toBe(false);
    expect(result!.has("agile")).toBe(false);
  });

  test("'change_coordinator' returns correct module set", () => {
    const result = getPackageToolFilter("change_coordinator");
    expect(result).not.toBeNull();
    expect(result!.has("changes")).toBe(true);
    expect(result!.has("incidents")).toBe(false);
  });

  test("'platform_developer' returns correct module set", () => {
    const result = getPackageToolFilter("platform_developer");
    expect(result).not.toBeNull();
    expect(result!.has("scripts")).toBe(true);
    expect(result!.has("workflows")).toBe(true);
    expect(result!.has("changesets")).toBe(true);
    expect(result!.has("schema")).toBe(true);
    expect(result!.has("incidents")).toBe(false);
  });

  test("unknown package returns null (fallback to full) and logs warning", () => {
    const result = getPackageToolFilter("nonexistent_package");
    expect(result).toBeNull();
    // Logger uses console.error for stderr
    expect(warnSpy).toHaveBeenCalled();
  });

  test("all defined packages are valid", () => {
    const packageNames = Object.keys(TOOL_PACKAGES);
    expect(packageNames.length).toBeGreaterThanOrEqual(8);
    for (const name of packageNames) {
      if (name === "full") continue;
      const result = getPackageToolFilter(name);
      expect(result).toBeInstanceOf(Set);
      expect(result!.size).toBeGreaterThan(0);
    }
  });

  test("all packages include 'tables' module", () => {
    for (const [name, modules] of Object.entries(TOOL_PACKAGES)) {
      expect(modules).toContain("tables");
    }
  });
});
