import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";

export function registerImportSetTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool(
    "sn_create_import_set",
    {
      description: "Create records in a ServiceNow import set staging table. Import sets are used to bulk-load data into ServiceNow before transforming it into target tables. Returns the import set sys_id and staging table records created.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        staging_table: z.string().describe("Import set staging table name (e.g. 'u_import_users', 'imp_computer')"),
        records: z.array(z.record(z.string(), z.unknown())).min(1).describe("Array of records to insert into the staging table"),
      },
    },
    async ({ instance, staging_table, records }) => {
      const client = registry.resolve(instance);
      const created: Array<{ sys_id: unknown; success: boolean }> = [];
      const errors: Array<{ index: number; error: string }> = [];

      for (const [index, record] of records.entries()) {
        try {
          const result = await client.createRecord(staging_table, record);
          created.push({ sys_id: result["sys_id"], success: true });
        } catch (err) {
          errors.push({ index, error: (err as Error).message });
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            staging_table,
            total: records.length,
            created: created.length,
            failed: errors.length,
            records: created,
            errors: errors.length > 0 ? errors : undefined,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    "sn_run_transform",
    {
      description: "Run a transform map to transform import set staging data into target table records. The transform map defines how staging table columns map to target table fields.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        transform_map_sys_id: z.string().describe("sys_id of the transform map to execute"),
        import_set_sys_id: z.string().optional().describe("sys_id of a specific import set to transform. If omitted, transforms all pending records."),
      },
    },
    async ({ instance, transform_map_sys_id, import_set_sys_id }) => {
      const client = registry.resolve(instance);

      // Get transform map details first
      const transformMap = await client.getRecord("sys_transform_map", transform_map_sys_id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      // Execute transform via the REST API
      const body: Record<string, unknown> = {
        transform_map: transform_map_sys_id,
      };
      if (import_set_sys_id) {
        body["import_set"] = import_set_sys_id;
      }

      const response = await client.requestRaw(
        "POST",
        "/api/now/import/${staging_table}/insertMultiple".replace(
          "${staging_table}",
          (transformMap["source_table"] as string) || "unknown"
        ),
        body
      );

      let result: unknown;
      try {
        const data = await response.json() as { result?: unknown };
        result = data.result ?? data;
      } catch {
        result = { status: response.status, statusText: response.statusText };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            transform_map: transformMap["name"],
            source_table: transformMap["source_table"],
            target_table: transformMap["target_table"],
            result,
          }, null, 2),
        }],
      };
    }
  );
}
