import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";
import { joinQueries } from "../utils/query.ts";

export function registerCatalogTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool(
    "sn_list_catalogs",
    {
      description: "List service catalogs from ServiceNow.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ instance, limit }) => {
      const client = registry.resolve(instance);
      const result = await client.queryTable("sc_catalog", {
        sysparm_fields: "sys_id,title,description,active", sysparm_limit: limit,
        sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, catalogs: result.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_list_catalog_items",
    {
      description: "List service catalog items with optional category filter.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        query: z.string().optional(),
        category: z.string().optional().describe("Category sys_id or name"),
        active: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ instance, query, category, active, limit, offset }) => {
      const client = registry.resolve(instance);
      const parts: string[] = [];
      if (query) parts.push(query);
      if (category) parts.push(`category.title=${category}`);
      if (active !== undefined) parts.push(`active=${active}`);
      const result = await client.queryTable("sc_cat_item", {
        sysparm_query: joinQueries(...parts, "ORDERBYname"),
        sysparm_fields: "sys_id,name,short_description,category,active,price,recurring_price,sys_class_name",
        sysparm_limit: limit, sysparm_offset: offset, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, items: result.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_get_catalog_item",
    {
      description: "Get a specific catalog item with its variables.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Catalog item sys_id"),
      },
    },
    async ({ instance, sys_id }) => {
      const client = registry.resolve(instance);
      const [item, vars] = await Promise.all([
        client.getRecord("sc_cat_item", sys_id, { sysparm_display_value: "all", sysparm_exclude_reference_link: "true" }),
        client.queryTable("item_option_new", {
          sysparm_query: `cat_item=${sys_id}^ORDERBYorder`, sysparm_limit: 100,
          sysparm_fields: "sys_id,name,question_text,type,mandatory,default_value,order,active",
          sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
        }),
      ]);
      return { content: [{ type: "text" as const, text: JSON.stringify({ item, variables: vars.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_update_catalog_item",
    {
      description: "Update a service catalog item.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string(),
        data: z.record(z.string(), z.unknown()),
      },
    },
    async ({ instance, sys_id, data }) => {
      const client = registry.resolve(instance);
      const record = await client.updateRecord("sc_cat_item", sys_id, data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, sys_id: record["sys_id"], record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_list_catalog_categories",
    {
      description: "List service catalog categories.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        catalog: z.string().optional().describe("Catalog sys_id"),
        limit: z.number().int().min(1).max(100).default(50),
      },
    },
    async ({ instance, catalog, limit }) => {
      const client = registry.resolve(instance);
      const parts: string[] = [];
      if (catalog) parts.push(`sc_catalog=${catalog}`);
      const result = await client.queryTable("sc_category", {
        sysparm_query: joinQueries(...parts, "ORDERBYtitle"),
        sysparm_fields: "sys_id,title,description,parent,sc_catalog,active",
        sysparm_limit: limit, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, categories: result.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_create_catalog_category",
    {
      description: "Create a new service catalog category.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        title: z.string(),
        description: z.string().optional(),
        sc_catalog: z.string().optional().describe("Catalog sys_id"),
        parent: z.string().optional().describe("Parent category sys_id"),
      },
    },
    async (params) => {
      const client = registry.resolve(params.instance);
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) { if (v !== undefined && k !== "instance") data[k] = v; }
      const record = await client.createRecord("sc_category", data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_update_catalog_category",
    {
      description: "Update a service catalog category.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string(),
        data: z.record(z.string(), z.unknown()),
      },
    },
    async ({ instance, sys_id, data }) => {
      const client = registry.resolve(instance);
      const record = await client.updateRecord("sc_category", sys_id, data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_move_catalog_items",
    {
      description: "Move catalog items to a different category.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        item_sys_ids: z.array(z.string()).describe("Array of catalog item sys_ids to move"),
        target_category_sys_id: z.string().describe("Target category sys_id"),
      },
    },
    async ({ instance, item_sys_ids, target_category_sys_id }) => {
      const client = registry.resolve(instance);
      const moved = [];
      for (const id of item_sys_ids) {
        await client.updateRecord("sc_cat_item", id, { category: target_category_sys_id });
        moved.push(id);
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ moved: moved.length, items: moved, target_category: target_category_sys_id }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_create_catalog_variable",
    {
      description: "Create a new variable (form field) for a catalog item. Uses the item_option_new table.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        cat_item: z.string().describe("Catalog item sys_id"),
        name: z.string().describe("Variable name (internal)"),
        question_text: z.string().describe("Label shown to user"),
        type: z.string().default("6").describe("Variable type: 1=Yes/No, 2=Multi Line Text, 3=Multiple Choice, 5=Select Box, 6=Single Line Text, 7=Checkbox, 8=Reference, 9=Date, 10=Date/Time, 18=Lookup Select, 21=List Collector"),
        mandatory: z.boolean().default(false),
        default_value: z.string().optional(),
        order: z.number().int().optional().describe("Display order"),
      },
    },
    async (params) => {
      const client = registry.resolve(params.instance);
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) { if (v !== undefined && k !== "instance") data[k] = v; }
      const record = await client.createRecord("item_option_new", data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_list_catalog_variables",
    {
      description: "List variables for a catalog item.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        cat_item: z.string().describe("Catalog item sys_id"),
      },
    },
    async ({ instance, cat_item }) => {
      const client = registry.resolve(instance);
      const result = await client.queryTable("item_option_new", {
        sysparm_query: `cat_item=${cat_item}^ORDERBYorder`,
        sysparm_fields: "sys_id,name,question_text,type,mandatory,default_value,order,active",
        sysparm_limit: 100, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, variables: result.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_update_catalog_variable",
    {
      description: "Update a catalog item variable.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Variable sys_id"),
        data: z.record(z.string(), z.unknown()),
      },
    },
    async ({ instance, sys_id, data }) => {
      const client = registry.resolve(instance);
      const record = await client.updateRecord("item_option_new", sys_id, data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_validate_catalog_item",
    {
      description: "Validate a catalog item for common issues: missing description, no variables, inactive but referenced, missing category, duplicate names, mandatory variables without defaults. Returns a list of warnings and errors.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Catalog item sys_id"),
      },
    },
    async ({ instance, sys_id }) => {
      const client = registry.resolve(instance);
      const issues: { severity: "error" | "warning"; message: string }[] = [];

      // Fetch item and its variables in parallel
      const [item, varsResult] = await Promise.all([
        client.getRecord("sc_cat_item", sys_id, {
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
        }),
        client.queryTable("item_option_new", {
          sysparm_query: `cat_item=${sys_id}^ORDERBYorder`,
          sysparm_fields: "sys_id,name,question_text,type,mandatory,default_value,order,active",
          sysparm_limit: 200,
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
        }),
      ]);

      const variables = varsResult.records;

      // Check: missing short_description
      if (!item["short_description"] || (item["short_description"] as string).trim() === "") {
        issues.push({ severity: "error", message: "Missing short_description — item will be hard to find in the catalog" });
      }

      // Check: missing description
      if (!item["description"] || (item["description"] as string).trim() === "") {
        issues.push({ severity: "warning", message: "Missing detailed description — users may not understand what this item provides" });
      }

      // Check: no category
      if (!item["category"] || (item["category"] as string).trim() === "") {
        issues.push({ severity: "warning", message: "No category assigned — item may not appear in catalog navigation" });
      }

      // Check: inactive item
      if (item["active"] === "false" || item["active"] === false) {
        issues.push({ severity: "warning", message: "Item is inactive — it will not be visible to end users" });
      }

      // Check: no variables
      if (variables.length === 0) {
        issues.push({ severity: "warning", message: "No variables defined — item has no form fields for user input" });
      }

      // Check: mandatory variables without default values
      for (const v of variables) {
        if (v["mandatory"] === "true" || v["mandatory"] === true) {
          if (!v["default_value"] || (v["default_value"] as string).trim() === "") {
            issues.push({ severity: "warning", message: `Mandatory variable "${v["name"]}" (${v["question_text"]}) has no default value` });
          }
        }
      }

      // Check: inactive variables
      const inactiveVars = variables.filter((v) => v["active"] === "false" || v["active"] === false);
      if (inactiveVars.length > 0) {
        issues.push({ severity: "warning", message: `${inactiveVars.length} inactive variable(s) found — consider removing them` });
      }

      // Check: missing price
      if (!item["price"] || item["price"] === "0" || item["price"] === "$0.00") {
        issues.push({ severity: "warning", message: "No price set — may cause issues with cost tracking" });
      }

      // Check for duplicate variable names
      const varNames = variables.map((v) => v["name"] as string).filter(Boolean);
      const dupes = varNames.filter((name, idx) => varNames.indexOf(name) !== idx);
      if (dupes.length > 0) {
        issues.push({ severity: "error", message: `Duplicate variable names found: ${[...new Set(dupes)].join(", ")}` });
      }

      const errors = issues.filter((i) => i.severity === "error").length;
      const warnings = issues.filter((i) => i.severity === "warning").length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            valid: errors === 0,
            errors,
            warnings,
            issues,
            item_name: item["name"],
            item_sys_id: sys_id,
            variable_count: variables.length,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    "sn_get_catalog_recommendations",
    {
      description: "Get basic optimization recommendations for catalog items (items missing descriptions, inactive items, etc.).",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        limit: z.number().int().min(1).max(100).default(50),
      },
    },
    async ({ instance, limit }) => {
      const client = registry.resolve(instance);
      const [noDesc, inactive] = await Promise.all([
        client.queryTable("sc_cat_item", {
          sysparm_query: "active=true^short_descriptionISEMPTY", sysparm_limit: limit,
          sysparm_fields: "sys_id,name,category", sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
        }),
        client.queryTable("sc_cat_item", {
          sysparm_query: "active=false", sysparm_limit: limit,
          sysparm_fields: "sys_id,name,category,sys_updated_on", sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
        }),
      ]);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            recommendations: [
              { issue: "Missing short_description", count: noDesc.records.length, items: noDesc.records },
              { issue: "Inactive items (consider retiring)", count: inactive.records.length, items: inactive.records },
            ],
          }, null, 2),
        }],
      };
    }
  );
}
