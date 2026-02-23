import type { Config } from "../config.ts";
import { BasicAuthProvider } from "./basic.ts";
import { OAuthProvider } from "./oauth.ts";
import type { AuthProvider } from "./types.ts";

export type { AuthProvider } from "./types.ts";

/**
 * Factory: creates the correct auth provider based on config.
 */
export function createAuthProvider(config: Config): AuthProvider {
  switch (config.auth.type) {
    case "basic":
      return new BasicAuthProvider(config.auth.username, config.auth.password);

    case "oauth":
      return new OAuthProvider({
        instanceUrl: config.instanceUrl,
        clientId: config.auth.clientId,
        clientSecret: config.auth.clientSecret,
        username: config.auth.username,
        password: config.auth.password,
      });

    default:
      throw new Error(`Unsupported auth type: ${(config.auth as { type: string }).type}`);
  }
}
