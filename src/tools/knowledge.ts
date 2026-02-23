import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServiceNowClient } from "../client/index.ts";
import { joinQueries } from "../utils/query.ts";

export function registerKnowledgeTools(server: McpServer, client: ServiceNowClient): void {

  server.registerTool(
    "sn_list_knowledge_bases",
    {
      description: "List knowledge bases.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ limit }) => {
      const result = await client.queryTable("kb_knowledge_base", {
        sysparm_fields: "sys_id,title,description,active,owner", sysparm_limit: limit,
        sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, knowledge_bases: result.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_create_knowledge_base",
    {
      description: "Create a new knowledge base.",
      inputSchema: {
        title: z.string(),
        description: z.string().optional(),
        owner: z.string().optional().describe("Owner sys_id"),
      },
    },
    async (params) => {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) { if (v !== undefined) data[k] = v; }
      const record = await client.createRecord("kb_knowledge_base", data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_create_kb_category",
    {
      description: "Create a category in a knowledge base.",
      inputSchema: {
        label: z.string().describe("Category label"),
        parent_id: z.string().optional().describe("Parent category sys_id"),
        kb_knowledge_base: z.string().describe("Knowledge base sys_id"),
      },
    },
    async (params) => {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) { if (v !== undefined) data[k] = v; }
      const record = await client.createRecord("kb_category", data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, sys_id: record["sys_id"], record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_list_articles",
    {
      description: "List knowledge articles with optional filters.",
      inputSchema: {
        query: z.string().optional(),
        kb_knowledge_base: z.string().optional(),
        kb_category: z.string().optional(),
        workflow_state: z.string().optional().describe("e.g. 'published', 'draft', 'retired'"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ query, kb_knowledge_base, kb_category, workflow_state, limit, offset }) => {
      const parts: string[] = [];
      if (query) parts.push(query);
      if (kb_knowledge_base) parts.push(`kb_knowledge_base=${kb_knowledge_base}`);
      if (kb_category) parts.push(`kb_category=${kb_category}`);
      if (workflow_state) parts.push(`workflow_state=${workflow_state}`);
      const result = await client.queryTable("kb_knowledge", {
        sysparm_query: joinQueries(...parts, "ORDERBYDESCsys_created_on"),
        sysparm_fields: "sys_id,number,short_description,workflow_state,kb_knowledge_base,kb_category,author,sys_created_on",
        sysparm_limit: limit, sysparm_offset: offset, sysparm_display_value: "true", sysparm_exclude_reference_link: "true",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, pagination: result.pagination, articles: result.records }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_get_article",
    {
      description: "Get a knowledge article by sys_id or number.",
      inputSchema: {
        sys_id: z.string().optional(),
        number: z.string().optional(),
      },
    },
    async ({ sys_id, number }) => {
      if (sys_id) {
        const record = await client.getRecord("kb_knowledge", sys_id, { sysparm_display_value: "all", sysparm_exclude_reference_link: "true" });
        return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
      }
      if (number) {
        const result = await client.queryTable("kb_knowledge", { sysparm_query: `number=${number}`, sysparm_limit: 1, sysparm_display_value: "all", sysparm_exclude_reference_link: "true" });
        return { content: [{ type: "text" as const, text: JSON.stringify(result.records[0] ?? null, null, 2) }] };
      }
      return { content: [{ type: "text" as const, text: "Provide sys_id or number" }] };
    }
  );

  server.registerTool(
    "sn_create_article",
    {
      description: "Create a new knowledge article.",
      inputSchema: {
        short_description: z.string(),
        text: z.string().describe("Article body (HTML supported)"),
        kb_knowledge_base: z.string().describe("Knowledge base sys_id"),
        kb_category: z.string().optional().describe("Category sys_id"),
        author: z.string().optional().describe("Author sys_id"),
      },
    },
    async (params) => {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) { if (v !== undefined) data[k] = v; }
      const record = await client.createRecord("kb_knowledge", data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, number: record["number"], sys_id: record["sys_id"], record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_update_article",
    {
      description: "Update an existing knowledge article.",
      inputSchema: {
        sys_id: z.string(),
        data: z.record(z.string(), z.unknown()),
      },
    },
    async ({ sys_id, data }) => {
      const record = await client.updateRecord("kb_knowledge", sys_id, data);
      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, record }, null, 2) }] };
    }
  );

  server.registerTool(
    "sn_publish_article",
    {
      description: "Publish a knowledge article (set workflow_state to 'published').",
      inputSchema: {
        sys_id: z.string().describe("Article sys_id"),
      },
    },
    async ({ sys_id }) => {
      const record = await client.updateRecord("kb_knowledge", sys_id, { workflow_state: "published" });
      return { content: [{ type: "text" as const, text: JSON.stringify({ published: true, number: record["number"], sys_id: record["sys_id"] }, null, 2) }] };
    }
  );
}
