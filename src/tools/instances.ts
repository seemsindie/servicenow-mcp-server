import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";

/**
 * Instance management tools — list and inspect configured ServiceNow instances.
 */
export function registerInstanceTools(server: McpServer, registry: InstanceRegistry): void {

  // ── sn_list_instances ─────────────────────────────────
  server.registerTool(
    "sn_list_instances",
    {
      description: "List all configured ServiceNow instances. Shows instance names, URLs, and which is the default. Use this to discover available instances before targeting a specific one with the 'instance' parameter on other tools.",
      inputSchema: {},
    },
    async () => {
      const instances = registry.listInstances();
      const defaultName = registry.getDefaultName();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                default_instance: defaultName,
                total: instances.length,
                instances: instances.map((inst) => ({
                  name: inst.name,
                  url: inst.url,
                  is_default: inst.isDefault,
                  ...(inst.description ? { description: inst.description } : {}),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── sn_instance_info ──────────────────────────────────
  server.registerTool(
    "sn_instance_info",
    {
      description: "Get detailed information about a specific ServiceNow instance. If no instance name is provided, returns info about the default instance.",
      inputSchema: {
        instance: z.string().optional().describe("Instance name to inspect. Uses default instance if omitted."),
      },
    },
    async ({ instance }) => {
      const info = registry.getInstanceInfo(instance);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                name: info.name,
                url: info.url,
                is_default: info.isDefault,
                ...(info.description ? { description: info.description } : {}),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
