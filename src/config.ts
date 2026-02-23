import { z } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";
import { logger } from "./utils/logger.ts";

// ── Auth schemas (shared between single-instance and multi-instance) ──

const AuthBasicSchema = z.object({
  type: z.literal("basic"),
  username: z.string().min(1, "username is required"),
  password: z.string().min(1, "password is required"),
});

const AuthOAuthSchema = z.object({
  type: z.literal("oauth"),
  clientId: z.string().min(1, "clientId is required"),
  clientSecret: z.string().min(1, "clientSecret is required"),
  username: z.string().optional(),
  password: z.string().optional(),
});

const AuthSchema = z.discriminatedUnion("type", [
  AuthBasicSchema,
  AuthOAuthSchema,
]);

// ── Per-instance schema ──────────────────────────────────────────────

const InstanceSchema = z.object({
  name: z.string().min(1, "Instance name is required"),
  url: z
    .string()
    .url("Instance URL must be a valid URL")
    .transform((url) => url.replace(/\/+$/, "")),
  auth: AuthSchema,
  default: z.boolean().default(false),
  description: z.string().optional(),
});

const InstancesFileSchema = z
  .object({
    instances: z.array(InstanceSchema).min(1, "At least one instance is required"),
  })
  .refine(
    (data) => data.instances.filter((i) => i.default).length <= 1,
    "At most one instance can be marked as default"
  );

// ── Top-level config schema ──────────────────────────────────────────

export const ConfigSchema = z.object({
  instances: z.array(InstanceSchema).min(1),
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
export type InstanceConfig = z.infer<typeof InstanceSchema>;
export type AuthBasicConfig = z.infer<typeof AuthBasicSchema>;
export type AuthOAuthConfig = z.infer<typeof AuthOAuthSchema>;
export type AuthConfig = z.infer<typeof AuthSchema>;

/**
 * Default paths to search for the instances config file.
 * Resolved relative to the current working directory.
 */
const CONFIG_FILE_PATHS = [
  "config/servicenow-instances.json",
  "servicenow-instances.json",
];

/**
 * Try to load instances from a JSON config file.
 * Returns null if no config file is found.
 */
function loadInstancesFromFile(): InstanceConfig[] | null {
  for (const relPath of CONFIG_FILE_PATHS) {
    const absPath = resolve(process.cwd(), relPath);
    try {
      const raw = readFileSync(absPath, "utf-8");
      const parsed = JSON.parse(raw);
      const result = InstancesFileSchema.safeParse(parsed);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
          .join("\n");
        throw new Error(`Invalid instances config file (${relPath}):\n${issues}`);
      }
      logger.info(`Loaded ${result.data.instances.length} instance(s) from ${relPath}`);
      return result.data.instances;
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        continue; // file not found, try next path
      }
      throw err; // re-throw parse errors or permission errors
    }
  }
  return null;
}

/**
 * Build a single-instance config from environment variables (backward compat).
 */
function loadInstanceFromEnv(): InstanceConfig {
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
    name: "default",
    url: process.env["SERVICENOW_INSTANCE_URL"] ?? "",
    auth,
    default: true,
    description: "Loaded from environment variables",
  };

  const result = InstanceSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid ServiceNow configuration from environment variables:\n${issues}\n\n` +
        "Hint: Create config/servicenow-instances.json for multi-instance setup."
    );
  }

  return result.data;
}

/**
 * Load config: tries JSON config file first, falls back to env vars.
 * Throws a descriptive error if configuration is invalid.
 */
export function loadConfig(): Config {
  // Try config file first, fall back to env vars
  const instances = loadInstancesFromFile();
  if (instances) {
    logger.info("Using JSON config file for instance configuration");
  } else {
    logger.info("No config file found, falling back to environment variables");
  }

  const instanceList = instances ?? [loadInstanceFromEnv()];

  const raw = {
    instances: instanceList,
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
