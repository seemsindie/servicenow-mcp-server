#!/usr/bin/env bun
/**
 * ServiceNow MCP Server — Streamable HTTP transport entry point.
 *
 * Usage:
 *   bun run src/http.ts
 *
 * Starts an HTTP server with:
 *   GET  /health  — health check
 *   *    /mcp     — MCP Streamable HTTP endpoint
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { loadConfig } from "./config.ts";
import { createServer } from "./server.ts";
import { logger } from "./utils/logger.ts";

async function main() {
  const config = loadConfig();
  const server = createServer(config);

  const { host, port } = config.http;

  // Create a persistent transport for the MCP server (Web Standard API for Bun)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  await server.connect(transport);

  Bun.serve({
    hostname: host,
    port,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      // Health check
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({ status: "ok", server: "servicenow-mcp-server", version: "0.2.0" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // MCP endpoint
      if (url.pathname === "/mcp") {
        return transport.handleRequest(req);
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  logger.info(`ServiceNow MCP HTTP server listening on http://${host}:${port}`);
  logger.info(`MCP endpoint: http://${host}:${port}/mcp`);
  logger.info(`Health check: http://${host}:${port}/health`);
}

main().catch((error) => {
  logger.error("Failed to start HTTP server:", error);
  process.exit(1);
});
