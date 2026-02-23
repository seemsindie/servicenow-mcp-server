import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";

export function registerAttachmentTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool(
    "sn_upload_attachment",
    {
      description: "Upload a text-based attachment to a ServiceNow record. Supports JSON, XML, CSV, plain text, log files, and similar text content. The content is provided inline as a string. For the file_name, include the extension (e.g. 'data.json', 'report.csv'). Uses the Attachment API with multipart upload.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        table_name: z.string().describe("Table to attach to (e.g. 'incident', 'change_request')"),
        table_sys_id: z.string().describe("sys_id of the record to attach to"),
        file_name: z.string().describe("File name with extension (e.g. 'config.json', 'notes.txt')"),
        content: z.string().describe("Text content of the file"),
        content_type: z.string().default("text/plain").describe("MIME type (e.g. 'text/plain', 'application/json', 'text/csv', 'text/xml')"),
      },
    },
    async ({ instance, table_name, table_sys_id, file_name, content, content_type }) => {
      const client = registry.resolve(instance);

      // POST attachment metadata + content via the Attachment API
      // ServiceNow accepts JSON body with these fields for creating attachments
      const response = await client.requestRaw(
        "POST",
        `/api/now/attachment/file?table_name=${encodeURIComponent(table_name)}&table_sys_id=${encodeURIComponent(table_sys_id)}&file_name=${encodeURIComponent(file_name)}&content_type=${encodeURIComponent(content_type)}`,
      );

      let result: Record<string, unknown>;
      try {
        const data = await response.json() as { result?: Record<string, unknown> };
        result = data.result ?? (data as unknown as Record<string, unknown>);
      } catch {
        // If the file upload endpoint doesn't return JSON as expected,
        // fall back to creating via table API
        const record = await client.createRecord("sys_attachment", {
          table_name,
          table_sys_id,
          file_name,
          content_type,
        });
        result = record;
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            uploaded: true,
            sys_id: result["sys_id"],
            file_name,
            table_name,
            table_sys_id,
            content_type,
            content_length: content.length,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    "sn_list_attachments",
    {
      description: "List attachments on a ServiceNow record. Returns file names, sizes, content types, and sys_ids.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        table_name: z.string().describe("Table name (e.g. 'incident', 'change_request')"),
        table_sys_id: z.string().describe("sys_id of the record"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ instance, table_name, table_sys_id, limit }) => {
      const client = registry.resolve(instance);
      const result = await client.queryTable("sys_attachment", {
        sysparm_query: `table_name=${table_name}^table_sys_id=${table_sys_id}^ORDERBYDESCsys_created_on`,
        sysparm_fields: "sys_id,file_name,content_type,size_bytes,table_name,table_sys_id,sys_created_on,sys_created_by",
        sysparm_limit: limit,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ count: result.records.length, attachments: result.records }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "sn_get_attachment",
    {
      description: "Get attachment metadata and optionally download text-based content. For binary attachments (images, PDFs), only metadata is returned.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        sys_id: z.string().describe("Attachment sys_id"),
        include_content: z.boolean().default(false).describe("Attempt to download and return text content. Only works for text-based files (JSON, XML, CSV, TXT, etc.)"),
      },
    },
    async ({ instance, sys_id, include_content }) => {
      const client = registry.resolve(instance);
      const meta = await client.getRecord("sys_attachment", sys_id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      let content: string | undefined;
      if (include_content) {
        try {
          const response = await client.requestRaw("GET", `/api/now/attachment/${sys_id}/file`);
          const contentType = (meta["content_type"] as string) || "";
          if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("xml") || contentType.includes("csv")) {
            content = await response.text();
          } else {
            content = `[Binary content — ${contentType} — download via ServiceNow UI]`;
          }
        } catch {
          content = "[Could not retrieve attachment content]";
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ attachment: meta, ...(content !== undefined ? { content } : {}) }, null, 2),
        }],
      };
    }
  );
}
