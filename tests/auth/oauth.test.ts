import { describe, expect, test, beforeEach, afterEach, mock, type Mock } from "bun:test";
import { OAuthProvider } from "../../src/auth/oauth.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = Mock<(...args: any[]) => any>;

describe("OAuthProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(response: { access_token: string; token_type: string; expires_in: number }, status = 200) {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
  }

  test("name is 'oauth'", () => {
    const provider = new OAuthProvider({
      instanceUrl: "https://test.service-now.com",
      clientId: "client123",
      clientSecret: "secret456",
    });
    expect(provider.name).toBe("oauth");
  });

  test("getHeaders fetches token and returns Bearer header", async () => {
    mockFetch({ access_token: "tok_abc123", token_type: "Bearer", expires_in: 3600 });

    const provider = new OAuthProvider({
      instanceUrl: "https://test.service-now.com",
      clientId: "client123",
      clientSecret: "secret456",
      username: "admin",
      password: "pass",
    });

    const headers = await provider.getHeaders();
    expect(headers).toEqual({ Authorization: "Bearer tok_abc123" });

    // Verify fetch was called with correct URL
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
    expect(call[0]).toBe("https://test.service-now.com/oauth_token.do");

    // Verify POST body
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    const body = init.body as string;
    expect(body).toContain("grant_type=password");
    expect(body).toContain("client_id=client123");
    expect(body).toContain("client_secret=secret456");
    expect(body).toContain("username=admin");
    expect(body).toContain("password=pass");
  });

  test("caches token on subsequent calls", async () => {
    mockFetch({ access_token: "tok_cached", token_type: "Bearer", expires_in: 3600 });

    const provider = new OAuthProvider({
      instanceUrl: "https://test.service-now.com",
      clientId: "c1",
      clientSecret: "s1",
    });

    await provider.getHeaders();
    await provider.getHeaders();
    await provider.getHeaders();

    // Should only fetch once since token is cached
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test("throws on failed token request", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Invalid client", { status: 401 });
    }) as unknown as typeof fetch;

    const provider = new OAuthProvider({
      instanceUrl: "https://test.service-now.com",
      clientId: "bad",
      clientSecret: "bad",
    });

    await expect(provider.getHeaders()).rejects.toThrow("OAuth token request failed (401)");
  });

  test("omits username/password when not provided", async () => {
    mockFetch({ access_token: "tok_nouser", token_type: "Bearer", expires_in: 3600 });

    const provider = new OAuthProvider({
      instanceUrl: "https://test.service-now.com",
      clientId: "c1",
      clientSecret: "s1",
    });

    await provider.getHeaders();
    const call = (globalThis.fetch as unknown as AnyMock).mock.calls[0]!;
    const body = (call[1] as RequestInit).body as string;
    expect(body).not.toContain("username=");
    expect(body).not.toContain("password=");
  });
});
