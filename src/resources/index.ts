import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InstanceRegistry } from "../client/registry.ts";

/**
 * Register MCP resources — read-only servicenow:// URIs.
 * Resources always use the default instance.
 */
export function registerResources(
  server: McpServer,
  registry: InstanceRegistry
): void {
  // servicenow://incidents — recent incidents
  server.resource("recent-incidents", "servicenow://incidents", async (uri) => {
    const client = registry.resolve();
    const result = await client.queryTable("incident", {
      sysparm_limit: 20,
      sysparm_fields: "number,short_description,state,priority,assigned_to,sys_created_on",
      sysparm_query: "ORDERBYDESCsys_created_on",
      sysparm_display_value: "true",
    });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(result.records, null, 2),
        },
      ],
    };
  });

  // servicenow://users — active users
  server.resource("active-users", "servicenow://users", async (uri) => {
    const client = registry.resolve();
    const result = await client.queryTable("sys_user", {
      sysparm_limit: 50,
      sysparm_fields: "sys_id,user_name,first_name,last_name,email,department,active",
      sysparm_query: "active=true^ORDERBYlast_name",
      sysparm_display_value: "true",
    });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(result.records, null, 2),
        },
      ],
    };
  });

  // servicenow://knowledge — recent knowledge articles
  server.resource("knowledge-articles", "servicenow://knowledge", async (uri) => {
    const client = registry.resolve();
    const result = await client.queryTable("kb_knowledge", {
      sysparm_limit: 20,
      sysparm_fields: "number,short_description,workflow_state,kb_knowledge_base,kb_category,sys_created_on",
      sysparm_query: "workflow_state=published^ORDERBYDESCsys_created_on",
      sysparm_display_value: "true",
    });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(result.records, null, 2),
        },
      ],
    };
  });

  // servicenow://tables — list available tables
  server.resource("available-tables", "servicenow://tables", async (uri) => {
    const client = registry.resolve();
    const result = await client.queryTable("sys_db_object", {
      sysparm_limit: 200,
      sysparm_fields: "name,label,super_class,sys_id",
      sysparm_query: "ORDERBYname",
    });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(result.records, null, 2),
        },
      ],
    };
  });

  // servicenow://tables/{table} — records from any table
  server.resource(
    "table-records",
    new ResourceTemplate("servicenow://tables/{table}", { list: undefined }),
    async (uri, variables) => {
      const client = registry.resolve();
      const table = variables.table as string;
      const result = await client.queryTable(table, {
        sysparm_limit: 20,
        sysparm_query: "ORDERBYDESCsys_created_on",
        sysparm_display_value: "true",
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.records, null, 2),
          },
        ],
      };
    }
  );

  // servicenow://schema/{table} — table schema
  server.resource(
    "table-schema",
    new ResourceTemplate("servicenow://schema/{table}", { list: undefined }),
    async (uri, variables) => {
      const client = registry.resolve();
      const table = variables.table as string;
      const result = await client.queryTable("sys_dictionary", {
        sysparm_query: `name=${table}^ORDERBYelement`,
        sysparm_fields: "element,column_label,internal_type,max_length,mandatory,reference,default_value,active",
        sysparm_limit: 500,
        sysparm_display_value: "true",
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.records, null, 2),
          },
        ],
      };
    }
  );

  // servicenow://incidents/{number} — specific incident
  server.resource(
    "incident-by-number",
    new ResourceTemplate("servicenow://incidents/{number}", { list: undefined }),
    async (uri, variables) => {
      const client = registry.resolve();
      const number = variables.number as string;
      const result = await client.queryTable("incident", {
        sysparm_query: `number=${number}`,
        sysparm_limit: 1,
        sysparm_display_value: "all",
      });
      const record = result.records[0] ?? null;
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(record, null, 2),
          },
        ],
      };
    }
  );
}
