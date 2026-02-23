import { describe, expect, test } from "bun:test";
import { BasicAuthProvider } from "../../src/auth/basic.ts";

describe("BasicAuthProvider", () => {
  test("name is 'basic'", () => {
    const provider = new BasicAuthProvider("admin", "password");
    expect(provider.name).toBe("basic");
  });

  test("getHeaders returns correct Base64 Authorization header", async () => {
    const provider = new BasicAuthProvider("admin", "password");
    const headers = await provider.getHeaders();
    const expected = btoa("admin:password");
    expect(headers).toEqual({ Authorization: `Basic ${expected}` });
  });

  test("handles special characters in credentials", async () => {
    const provider = new BasicAuthProvider("user@domain.com", "p@ss:w0rd!");
    const headers = await provider.getHeaders();
    const expected = btoa("user@domain.com:p@ss:w0rd!");
    expect(headers).toEqual({ Authorization: `Basic ${expected}` });
  });

  test("returns same headers on multiple calls (idempotent)", async () => {
    const provider = new BasicAuthProvider("admin", "test");
    const h1 = await provider.getHeaders();
    const h2 = await provider.getHeaders();
    expect(h1).toEqual(h2);
  });
});
