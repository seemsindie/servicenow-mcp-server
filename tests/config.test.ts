import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  function setBasicEnv() {
    process.env["SERVICENOW_INSTANCE_URL"] = "https://test.service-now.com";
    process.env["SERVICENOW_AUTH_TYPE"] = "basic";
    process.env["SERVICENOW_USERNAME"] = "admin";
    process.env["SERVICENOW_PASSWORD"] = "password123";
  }

  beforeEach(() => {
    // Clear all SN-related env vars
    delete process.env["SERVICENOW_INSTANCE_URL"];
    delete process.env["SERVICENOW_AUTH_TYPE"];
    delete process.env["SERVICENOW_USERNAME"];
    delete process.env["SERVICENOW_PASSWORD"];
    delete process.env["SERVICENOW_CLIENT_ID"];
    delete process.env["SERVICENOW_CLIENT_SECRET"];
    delete process.env["SN_TOOL_PACKAGE"];
    delete process.env["SN_DEBUG"];
    delete process.env["SN_HTTP_PORT"];
    delete process.env["SN_HTTP_HOST"];
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SERVICENOW_") || key.startsWith("SN_")) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  test("loads valid basic auth config from env", () => {
    setBasicEnv();
    const config = loadConfig();

    // Config now uses instances[] instead of top-level instanceUrl/auth
    expect(config.instances).toHaveLength(1);
    expect(config.instances[0]!.url).toBe("https://test.service-now.com");
    expect(config.instances[0]!.name).toBe("default");
    expect(config.instances[0]!.auth.type).toBe("basic");
    if (config.instances[0]!.auth.type === "basic") {
      expect(config.instances[0]!.auth.username).toBe("admin");
      expect(config.instances[0]!.auth.password).toBe("password123");
    }
    expect(config.toolPackage).toBe("full");
    expect(config.debug).toBe(false);
    expect(config.http.port).toBe(3000);
    expect(config.http.host).toBe("127.0.0.1");
  });

  test("strips trailing slashes from instance URL", () => {
    setBasicEnv();
    process.env["SERVICENOW_INSTANCE_URL"] = "https://test.service-now.com///";
    const config = loadConfig();
    expect(config.instances[0]!.url).toBe("https://test.service-now.com");
  });

  test("loads oauth config from env", () => {
    process.env["SERVICENOW_INSTANCE_URL"] = "https://test.service-now.com";
    process.env["SERVICENOW_AUTH_TYPE"] = "oauth";
    process.env["SERVICENOW_CLIENT_ID"] = "client123";
    process.env["SERVICENOW_CLIENT_SECRET"] = "secret456";
    process.env["SERVICENOW_USERNAME"] = "admin";
    process.env["SERVICENOW_PASSWORD"] = "pass";

    const config = loadConfig();
    const auth = config.instances[0]!.auth;
    expect(auth.type).toBe("oauth");
    if (auth.type === "oauth") {
      expect(auth.clientId).toBe("client123");
      expect(auth.clientSecret).toBe("secret456");
      expect(auth.username).toBe("admin");
      expect(auth.password).toBe("pass");
    }
  });

  test("defaults to basic auth when SERVICENOW_AUTH_TYPE is not set", () => {
    process.env["SERVICENOW_INSTANCE_URL"] = "https://test.service-now.com";
    process.env["SERVICENOW_USERNAME"] = "admin";
    process.env["SERVICENOW_PASSWORD"] = "pass";

    const config = loadConfig();
    expect(config.instances[0]!.auth.type).toBe("basic");
  });

  test("env-loaded instance is marked as default", () => {
    setBasicEnv();
    const config = loadConfig();
    expect(config.instances[0]!.default).toBe(true);
  });

  test("respects SN_DEBUG=true", () => {
    setBasicEnv();
    process.env["SN_DEBUG"] = "true";
    const config = loadConfig();
    expect(config.debug).toBe(true);
  });

  test("respects custom HTTP port and host", () => {
    setBasicEnv();
    process.env["SN_HTTP_PORT"] = "8080";
    process.env["SN_HTTP_HOST"] = "0.0.0.0";
    const config = loadConfig();
    expect(config.http.port).toBe(8080);
    expect(config.http.host).toBe("0.0.0.0");
  });

  test("respects custom tool package", () => {
    setBasicEnv();
    process.env["SN_TOOL_PACKAGE"] = "service_desk";
    const config = loadConfig();
    expect(config.toolPackage).toBe("service_desk");
  });

  test("throws on missing instance URL", () => {
    process.env["SERVICENOW_USERNAME"] = "admin";
    process.env["SERVICENOW_PASSWORD"] = "pass";
    // No SERVICENOW_INSTANCE_URL
    expect(() => loadConfig()).toThrow();
  });

  test("throws on missing basic auth credentials", () => {
    process.env["SERVICENOW_INSTANCE_URL"] = "https://test.service-now.com";
    // No username/password
    expect(() => loadConfig()).toThrow();
  });

  test("throws on missing oauth client credentials", () => {
    process.env["SERVICENOW_INSTANCE_URL"] = "https://test.service-now.com";
    process.env["SERVICENOW_AUTH_TYPE"] = "oauth";
    // No client ID/secret
    expect(() => loadConfig()).toThrow();
  });

  test("throws on invalid URL", () => {
    process.env["SERVICENOW_INSTANCE_URL"] = "not-a-url";
    process.env["SERVICENOW_USERNAME"] = "admin";
    process.env["SERVICENOW_PASSWORD"] = "pass";
    expect(() => loadConfig()).toThrow();
  });
});
