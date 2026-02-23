import { z } from "zod";

const AuthBasicSchema = z.object({
  type: z.literal("basic"),
  username: z.string().min(1, "SERVICENOW_USERNAME is required"),
  password: z.string().min(1, "SERVICENOW_PASSWORD is required"),
});

const AuthOAuthSchema = z.object({
  type: z.literal("oauth"),
  clientId: z.string().min(1, "SERVICENOW_CLIENT_ID is required"),
  clientSecret: z.string().min(1, "SERVICENOW_CLIENT_SECRET is required"),
  username: z.string().optional(),
  password: z.string().optional(),
});

const AuthSchema = z.discriminatedUnion("type", [
  AuthBasicSchema,
  AuthOAuthSchema,
]);

export const ConfigSchema = z.object({
  instanceUrl: z
    .string()
    .url("SERVICENOW_INSTANCE_URL must be a valid URL")
    .transform((url) => url.replace(/\/+$/, "")), // strip trailing slashes
  auth: AuthSchema,
  toolPackage: z.string().default("full"),
  debug: z.boolean().default(false),
  http: z
    .object({
      port: z.number().int().positive().default(3000),
      host: z.string().default("127.0.0.1"),
    })
    .default({ port: 3000, host: "127.0.0.1" }),
});

export type Config = z.infer<typeof ConfigSchema>;
export type AuthBasicConfig = z.infer<typeof AuthBasicSchema>;
export type AuthOAuthConfig = z.infer<typeof AuthOAuthSchema>;
export type AuthConfig = z.infer<typeof AuthSchema>;

/**
 * Load config from environment variables.
 * Throws a descriptive error if required vars are missing.
 */
export function loadConfig(): Config {
  const authType = (process.env["SERVICENOW_AUTH_TYPE"] ?? "basic").toLowerCase();

  let auth: unknown;
  if (authType === "oauth") {
    auth = {
      type: "oauth" as const,
      clientId: process.env["SERVICENOW_CLIENT_ID"] ?? "",
      clientSecret: process.env["SERVICENOW_CLIENT_SECRET"] ?? "",
      username: process.env["SERVICENOW_USERNAME"] || undefined,
      password: process.env["SERVICENOW_PASSWORD"] || undefined,
    };
  } else {
    auth = {
      type: "basic" as const,
      username: process.env["SERVICENOW_USERNAME"] ?? "",
      password: process.env["SERVICENOW_PASSWORD"] ?? "",
    };
  }

  const raw = {
    instanceUrl: process.env["SERVICENOW_INSTANCE_URL"] ?? "",
    auth,
    toolPackage: process.env["SN_TOOL_PACKAGE"] ?? "full",
    debug: process.env["SN_DEBUG"] === "true",
    http: {
      port: Number(process.env["SN_HTTP_PORT"] ?? 3000),
      host: process.env["SN_HTTP_HOST"] ?? "127.0.0.1",
    },
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid ServiceNow MCP server configuration:\n${issues}`);
  }

  return result.data;
}
