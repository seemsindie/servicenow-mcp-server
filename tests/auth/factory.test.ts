import { describe, expect, test } from "bun:test";
import { createAuthProvider } from "../../src/auth/index.ts";
import { BasicAuthProvider } from "../../src/auth/basic.ts";
import { OAuthProvider } from "../../src/auth/oauth.ts";
import type { AuthConfig } from "../../src/config.ts";

const INSTANCE_URL = "https://test.service-now.com";

describe("createAuthProvider", () => {
  test("creates BasicAuthProvider for basic auth type", () => {
    const auth: AuthConfig = { type: "basic", username: "admin", password: "pass" };
    const provider = createAuthProvider(INSTANCE_URL, auth);
    expect(provider).toBeInstanceOf(BasicAuthProvider);
    expect(provider.name).toBe("basic");
  });

  test("creates OAuthProvider for oauth auth type", () => {
    const auth: AuthConfig = { type: "oauth", clientId: "c1", clientSecret: "s1" };
    const provider = createAuthProvider(INSTANCE_URL, auth);
    expect(provider).toBeInstanceOf(OAuthProvider);
    expect(provider.name).toBe("oauth");
  });
});
