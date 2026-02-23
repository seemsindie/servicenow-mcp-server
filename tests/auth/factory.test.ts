import { describe, expect, test } from "bun:test";
import { createAuthProvider } from "../../src/auth/index.ts";
import { BasicAuthProvider } from "../../src/auth/basic.ts";
import { OAuthProvider } from "../../src/auth/oauth.ts";
import type { Config } from "../../src/config.ts";

function makeConfig(authType: "basic" | "oauth"): Config {
  const base = {
    instanceUrl: "https://test.service-now.com",
    toolPackage: "full",
    debug: false,
    http: { port: 3000, host: "127.0.0.1" },
  };

  if (authType === "basic") {
    return { ...base, auth: { type: "basic", username: "admin", password: "pass" } };
  }
  return { ...base, auth: { type: "oauth", clientId: "c1", clientSecret: "s1" } };
}

describe("createAuthProvider", () => {
  test("creates BasicAuthProvider for basic auth type", () => {
    const provider = createAuthProvider(makeConfig("basic"));
    expect(provider).toBeInstanceOf(BasicAuthProvider);
    expect(provider.name).toBe("basic");
  });

  test("creates OAuthProvider for oauth auth type", () => {
    const provider = createAuthProvider(makeConfig("oauth"));
    expect(provider).toBeInstanceOf(OAuthProvider);
    expect(provider.name).toBe("oauth");
  });
});
