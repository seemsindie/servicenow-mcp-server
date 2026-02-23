import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.ts";
import { createAuthProvider } from "./auth/index.ts";
import { ServiceNowClient } from "./client/index.ts";
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

// Resources
import { registerResources } from "./resources/index.ts";

// Packages
import { getPackageToolFilter } from "./packages/index.ts";

/**
 * All tool registration functions with their package key.
 */
const TOOL_MODULES: { key: string; register: (server: McpServer, client: ServiceNowClient) => void }[] = [
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
];

/**
 * Creates and configures the MCP server with all tools and resources.
 */
export function createServer(config: Config): McpServer {
  setDebug(config.debug);

  logger.info("Creating ServiceNow MCP server");
  logger.info(`Instance: ${config.instanceUrl}`);
  logger.info(`Auth: ${config.auth.type}`);
  logger.info(`Tool package: ${config.toolPackage}`);

  // Create auth provider & SN client
  const auth = createAuthProvider(config);
  const client = new ServiceNowClient(config.instanceUrl, auth);

  // Create MCP server
  const server = new McpServer({
    name: "servicenow-mcp-server",
    version: "0.1.0",
  });

  // Get the tool filter for the selected package
  const allowedModules = getPackageToolFilter(config.toolPackage);

  // Register tools from each module (filtered by package)
  let registeredModules = 0;
  for (const mod of TOOL_MODULES) {
    if (allowedModules === null || allowedModules.has(mod.key)) {
      mod.register(server, client);
      registeredModules++;
      logger.debug(`Registered tool module: ${mod.key}`);
    } else {
      logger.debug(`Skipped tool module (not in package): ${mod.key}`);
    }
  }

  logger.info(`Registered ${registeredModules}/${TOOL_MODULES.length} tool modules`);

  // Register MCP resources (always available)
  registerResources(server, client);
  logger.info("Registered MCP resources");

  return server;
}
