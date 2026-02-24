import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.ts";
import { InstanceRegistry } from "./client/registry.ts";
import { logger, setDebug } from "./utils/logger.ts";

// Tool modules
import { registerTableTools } from "./tools/tables.ts";
import { registerIncidentTools } from "./tools/incidents.ts";
import { registerUserTools } from "./tools/users.ts";
import { registerChangeTools } from "./tools/changes.ts";
import { registerCatalogTools } from "./tools/catalog.ts";
import { registerKnowledgeTools } from "./tools/knowledge.ts";
import { registerWorkflowTools } from "./tools/workflows.ts";
import { registerScriptTools } from "./tools/scripts.ts";
import { registerChangesetTools } from "./tools/changesets.ts";
import { registerAgileTools } from "./tools/agile.ts";
import { registerCmdbTools } from "./tools/cmdb.ts";
import { registerSchemaTools } from "./tools/schema.ts";
import { registerSearchTools } from "./tools/search.ts";
import { registerBatchTools } from "./tools/batch.ts";
import { registerInstanceTools } from "./tools/instances.ts";
import { registerBackgroundScriptTools } from "./tools/background-scripts.ts";
import { registerPlatformScriptTools } from "./tools/platform-scripts.ts";
import { registerScriptedRestTools } from "./tools/scripted-rest.ts";
import { registerWidgetTools } from "./tools/widgets.ts";
import { registerUiPageTools } from "./tools/ui-pages.ts";
import { registerFlowTools } from "./tools/flows.ts";
import { registerAppScopeTools } from "./tools/app-scope.ts";
import { registerScriptSyncTools } from "./tools/script-sync.ts";
import { registerProblemTools } from "./tools/problems.ts";
import { registerRequestTools } from "./tools/requests.ts";
import { registerAttachmentTools } from "./tools/attachments.ts";
import { registerAggregationTools } from "./tools/aggregation.ts";
import { registerImportSetTools } from "./tools/import-sets.ts";

// Resources
import { registerResources } from "./resources/index.ts";

// Packages
import { getPackageToolFilter } from "./packages/index.ts";

/**
 * All tool registration functions with their package key.
 */
const TOOL_MODULES: { key: string; register: (server: McpServer, registry: InstanceRegistry) => void }[] = [
  { key: "tables", register: registerTableTools },
  { key: "incidents", register: registerIncidentTools },
  { key: "users", register: registerUserTools },
  { key: "changes", register: registerChangeTools },
  { key: "catalog", register: registerCatalogTools },
  { key: "knowledge", register: registerKnowledgeTools },
  { key: "workflows", register: registerWorkflowTools },
  { key: "scripts", register: registerScriptTools },
  { key: "changesets", register: registerChangesetTools },
  { key: "agile", register: registerAgileTools },
  { key: "cmdb", register: registerCmdbTools },
  { key: "schema", register: registerSchemaTools },
  { key: "search", register: registerSearchTools },
  { key: "batch", register: registerBatchTools },
  { key: "background_scripts", register: registerBackgroundScriptTools },
  { key: "platform_scripts", register: registerPlatformScriptTools },
  { key: "scripted_rest", register: registerScriptedRestTools },
  { key: "widgets", register: registerWidgetTools },
  { key: "ui_pages", register: registerUiPageTools },
  { key: "flows", register: registerFlowTools },
  { key: "app_scope", register: registerAppScopeTools },
  { key: "script_sync", register: registerScriptSyncTools },
  { key: "problems", register: registerProblemTools },
  { key: "requests", register: registerRequestTools },
  { key: "attachments", register: registerAttachmentTools },
  { key: "aggregation", register: registerAggregationTools },
  { key: "import_sets", register: registerImportSetTools },
];

/** Abbreviations that should be uppercased in tool titles. */
const UPPERCASE_ABBREVIATIONS = new Set(["ci", "kb", "api", "ui", "rest", "cmdb", "apis"]);

/**
 * Generates a human-readable title from a snake_case tool name.
 * e.g. "sn_get_record" -> "Get Record", "sn_list_ci_relationships" -> "List CI Relationships"
 */
function generateToolTitle(name: string): string {
  const stripped = name.startsWith("sn_") ? name.slice(3) : name;
  return stripped
    .split("_")
    .map((word) => (UPPERCASE_ABBREVIATIONS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/**
 * Creates and configures the MCP server with all tools and resources.
 */
export function createServer(config: Config): McpServer {
  setDebug(config.debug);

  logger.info("Creating ServiceNow MCP server");
  logger.info(`Instances: ${config.instances.map((i) => i.name).join(", ")}`);
  logger.info(`Tool package: ${config.toolPackage}`);

  // Build instance registry (creates auth + client per instance)
  const registry = new InstanceRegistry(config.instances);

  // Create MCP server
  const server = new McpServer({
    name: "servicenow-mcp-server",
    version: "0.4.0",
  });

  // Wrap registerTool to auto-generate human-readable titles from tool names
  const originalRegisterTool = server.registerTool.bind(server);
  server.registerTool = ((name: string, config: Record<string, unknown>, ...rest: unknown[]) => {
    if (!config.title) {
      config.title = generateToolTitle(name);
    }
    return originalRegisterTool(name, config, ...rest);
  }) as typeof server.registerTool;

  // Get the tool filter for the selected package
  const allowedModules = getPackageToolFilter(config.toolPackage);

  // Register tools from each module (filtered by package)
  let registeredModules = 0;
  for (const mod of TOOL_MODULES) {
    if (allowedModules === null || allowedModules.has(mod.key)) {
      mod.register(server, registry);
      registeredModules++;
      logger.debug(`Registered tool module: ${mod.key}`);
    } else {
      logger.debug(`Skipped tool module (not in package): ${mod.key}`);
    }
  }

  logger.info(`Registered ${registeredModules}/${TOOL_MODULES.length} tool modules`);

  // Register instance management tools (always available)
  registerInstanceTools(server, registry);
  logger.info("Registered instance management tools");

  // Register MCP resources (always available, uses default instance)
  registerResources(server, registry);
  logger.info("Registered MCP resources");

  return server;
}
