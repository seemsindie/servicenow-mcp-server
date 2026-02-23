#!/usr/bin/env bun
/**
 * ServiceNow MCP Server — stdio transport entry point.
 *
 * Usage:
 *   bun run src/index.ts
 *
 * All logging goes to stderr. stdout is reserved for MCP JSON-RPC messages.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.ts";
import { createServer } from "./server.ts";
import { logger } from "./utils/logger.ts";

async function main() {
  try {
    const config = loadConfig();
    const server = createServer(config);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("ServiceNow MCP server running on stdio");
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
