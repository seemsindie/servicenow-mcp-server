import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "../src/config.ts";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

/**
 * Tests for loadConfig() — JSON-file-only configuration.
 *
 * Strategy: write temp JSON files, call loadConfig(path), verify output or errors.
 */
const TMP_DIR = join(import.meta.dir, ".tmp-config-test");

function writeTempConfig(filename: string, content: unknown): string {
  const filePath = join(TMP_DIR, filename);
  writeFileSync(filePath, JSON.stringify(content, null, 2), "utf-8");
  return filePath;
}

function minimalConfig(overrides: Record<string, unknown> = {}) {
  return {
    instances: [
      {
        name: "dev",
        url: "https://dev.service-now.com",
        auth: { type: "basic", username: "admin", password: "pass" },
        default: true,
      },
    ],
    ...overrides,
  };
}

describe("loadConfig", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  // ── Valid configs ──────────────────────────────────────

  test("loads a valid single-instance config", () => {
    const path = writeTempConfig("basic.json", minimalConfig());
    const config = loadConfig(path);

    expect(config.instances).toHaveLength(1);
    expect(config.instances[0]!.name).toBe("dev");
    expect(config.instances[0]!.url).toBe("https://dev.service-now.com");
    expect(config.instances[0]!.auth.type).toBe("basic");
    expect(config.instances[0]!.default).toBe(true);
  });

  test("loads a valid multi-instance config", () => {
    const path = writeTempConfig("multi.json", {
      instances: [
        {
          name: "dev",
          url: "https://dev.service-now.com",
          auth: { type: "basic", username: "admin", password: "pass" },
          default: true,
          description: "Dev environment",
        },
        {
          name: "prod",
          url: "https://prod.service-now.com",
          auth: {
            type: "oauth",
            clientId: "c1",
            clientSecret: "s1",
            username: "admin",
            password: "pass",
          },
        },
      ],
    });
    const config = loadConfig(path);

    expect(config.instances).toHaveLength(2);
    expect(config.instances[0]!.name).toBe("dev");
    expect(config.instances[0]!.description).toBe("Dev environment");
    expect(config.instances[1]!.name).toBe("prod");
    expect(config.instances[1]!.auth.type).toBe("oauth");
  });

  test("loads oauth config with all fields", () => {
    const path = writeTempConfig("oauth.json", {
      instances: [
        {
          name: "prod",
          url: "https://prod.service-now.com",
          auth: {
            type: "oauth",
            clientId: "client123",
            clientSecret: "secret456",
            username: "admin",
            password: "pass",
          },
        },
      ],
    });
    const config = loadConfig(path);
    const auth = config.instances[0]!.auth;

    expect(auth.type).toBe("oauth");
    if (auth.type === "oauth") {
      expect(auth.clientId).toBe("client123");
      expect(auth.clientSecret).toBe("secret456");
      expect(auth.username).toBe("admin");
      expect(auth.password).toBe("pass");
    }
  });

  // ── Defaults ───────────────────────────────────────────

  test("applies default toolPackage='full'", () => {
    const path = writeTempConfig("defaults.json", minimalConfig());
    const config = loadConfig(path);
    expect(config.toolPackage).toBe("full");
  });

  test("applies default debug=false", () => {
    const path = writeTempConfig("defaults.json", minimalConfig());
    const config = loadConfig(path);
    expect(config.debug).toBe(false);
  });

  test("applies default http settings", () => {
    const path = writeTempConfig("defaults.json", minimalConfig());
    const config = loadConfig(path);
    expect(config.http.port).toBe(3000);
    expect(config.http.host).toBe("127.0.0.1");
  });

  test("respects custom toolPackage", () => {
    const path = writeTempConfig("pkg.json", minimalConfig({ toolPackage: "service_desk" }));
    const config = loadConfig(path);
    expect(config.toolPackage).toBe("service_desk");
  });

  test("respects custom debug=true", () => {
    const path = writeTempConfig("debug.json", minimalConfig({ debug: true }));
    const config = loadConfig(path);
    expect(config.debug).toBe(true);
  });

  test("respects custom http settings", () => {
    const path = writeTempConfig("http.json", minimalConfig({
      http: { port: 8080, host: "0.0.0.0" },
    }));
    const config = loadConfig(path);
    expect(config.http.port).toBe(8080);
    expect(config.http.host).toBe("0.0.0.0");
  });

  test("strips trailing slashes from instance URL", () => {
    const path = writeTempConfig("slash.json", {
      instances: [
        {
          name: "dev",
          url: "https://dev.service-now.com///",
          auth: { type: "basic", username: "admin", password: "pass" },
        },
      ],
    });
    const config = loadConfig(path);
    expect(config.instances[0]!.url).toBe("https://dev.service-now.com");
  });

  test("instance default defaults to false", () => {
    const path = writeTempConfig("nodefault.json", {
      instances: [
        {
          name: "dev",
          url: "https://dev.service-now.com",
          auth: { type: "basic", username: "admin", password: "pass" },
          // no "default" field
        },
      ],
    });
    const config = loadConfig(path);
    expect(config.instances[0]!.default).toBe(false);
  });

  // ── Error cases ────────────────────────────────────────

  test("throws when file not found (explicit path)", () => {
    expect(() => loadConfig(join(TMP_DIR, "nonexistent.json"))).toThrow();
  });

  test("throws on invalid JSON", () => {
    const filePath = join(TMP_DIR, "bad.json");
    writeFileSync(filePath, "not json {{{", "utf-8");
    expect(() => loadConfig(filePath)).toThrow("Invalid JSON");
  });

  test("throws on empty instances array", () => {
    const path = writeTempConfig("empty.json", { instances: [] });
    expect(() => loadConfig(path)).toThrow("At least one instance");
  });

  test("throws on missing instance URL", () => {
    const path = writeTempConfig("nourl.json", {
      instances: [
        { name: "dev", auth: { type: "basic", username: "admin", password: "pass" } },
      ],
    });
    expect(() => loadConfig(path)).toThrow("Invalid config file");
  });

  test("throws on invalid instance URL", () => {
    const path = writeTempConfig("badurl.json", {
      instances: [
        {
          name: "dev",
          url: "not-a-url",
          auth: { type: "basic", username: "admin", password: "pass" },
        },
      ],
    });
    expect(() => loadConfig(path)).toThrow("Invalid config file");
  });

  test("throws on missing basic auth credentials", () => {
    const path = writeTempConfig("noauth.json", {
      instances: [
        {
          name: "dev",
          url: "https://dev.service-now.com",
          auth: { type: "basic" },
        },
      ],
    });
    expect(() => loadConfig(path)).toThrow("Invalid config file");
  });

  test("throws on missing oauth client credentials", () => {
    const path = writeTempConfig("nooauth.json", {
      instances: [
        {
          name: "dev",
          url: "https://dev.service-now.com",
          auth: { type: "oauth" },
        },
      ],
    });
    expect(() => loadConfig(path)).toThrow("Invalid config file");
  });

  test("throws on multiple defaults", () => {
    const path = writeTempConfig("multidefault.json", {
      instances: [
        {
          name: "dev",
          url: "https://dev.service-now.com",
          auth: { type: "basic", username: "a", password: "b" },
          default: true,
        },
        {
          name: "prod",
          url: "https://prod.service-now.com",
          auth: { type: "basic", username: "a", password: "b" },
          default: true,
        },
      ],
    });
    expect(() => loadConfig(path)).toThrow("At most one instance");
  });

  test("throws on missing instance name", () => {
    const path = writeTempConfig("noname.json", {
      instances: [
        {
          url: "https://dev.service-now.com",
          auth: { type: "basic", username: "admin", password: "pass" },
        },
      ],
    });
    expect(() => loadConfig(path)).toThrow("Invalid config file");
  });

  // ── Auto-discovery (no explicit path) ──────────────────

  test("throws with helpful message when no config file found", () => {
    // loadConfig() with no arg will search cwd-relative paths — they won't exist
    // from the test runner's perspective, unless config/servicenow-config.json exists
    // We test this by calling loadConfig() from a known-empty dir
    const emptyDir = join(TMP_DIR, "empty-dir");
    mkdirSync(emptyDir, { recursive: true });
    const originalCwd = process.cwd();
    try {
      process.chdir(emptyDir);
      expect(() => loadConfig()).toThrow("No config file found");
    } finally {
      process.chdir(originalCwd);
    }
  });
});
