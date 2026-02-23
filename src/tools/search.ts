import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstanceRegistry } from "../client/registry.ts";

/**
 * Natural language search — translates plain English queries into ServiceNow encoded queries.
 * Pattern-based approach inspired by Happy-Technologies and sn-11ty encoded query operators.
 */

interface NLPattern {
  regex: RegExp;
  build: (match: RegExpMatchArray) => { query: string; table?: string };
}

const NL_PATTERNS: NLPattern[] = [
  // "high priority incidents" / "critical priority incidents"
  { regex: /\b(critical|high|moderate|low)\s+priority\b/i, build: (m) => {
    const map: Record<string, string> = { critical: "1", high: "2", moderate: "3", low: "4" };
    return { query: `priority=${map[m[1]!.toLowerCase()] ?? "1"}` };
  }},
  // "assigned to <name>"
  { regex: /\bassigned\s+to\s+(\S+)/i, build: (m) => ({ query: `assigned_to.user_name=${m[1]}` }) },
  // "opened this week" / "created this week"
  { regex: /\b(opened|created)\s+this\s+week\b/i, build: () => ({ query: "sys_created_onONThis week@javascript:gs.beginningOfThisWeek()@javascript:gs.endOfThisWeek()" }) },
  // "opened today" / "created today"
  { regex: /\b(opened|created)\s+today\b/i, build: () => ({ query: "sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()" }) },
  // "updated this week"
  { regex: /\bupdated\s+this\s+week\b/i, build: () => ({ query: "sys_updated_onONThis week@javascript:gs.beginningOfThisWeek()@javascript:gs.endOfThisWeek()" }) },
  // "open" / "active"
  { regex: /\b(open|active)\b/i, build: () => ({ query: "active=true" }) },
  // "closed" / "resolved"
  { regex: /\bclosed\b/i, build: () => ({ query: "state=7" }) },
  { regex: /\bresolved\b/i, build: () => ({ query: "state=6" }) },
  // "in progress"
  { regex: /\bin\s+progress\b/i, build: () => ({ query: "state=2" }) },
  // "on hold"
  { regex: /\bon\s+hold\b/i, build: () => ({ query: "state=3" }) },
  // "new"
  { regex: /\bnew\b/i, build: () => ({ query: "state=1" }) },
  // "emergency changes"
  { regex: /\bemergency\s+(changes?|change\s+requests?)\b/i, build: () => ({ query: "type=emergency", table: "change_request" }) },
  // "normal changes"
  { regex: /\bnormal\s+(changes?|change\s+requests?)\b/i, build: () => ({ query: "type=normal", table: "change_request" }) },
  // "from <group> team"
  { regex: /\bfrom\s+(\w[\w\s]*?)\s+team\b/i, build: (m) => ({ query: `assignment_group.nameLIKE${m[1]}` }) },
  // "about <keyword>" / "related to <keyword>"
  { regex: /\b(?:about|related\s+to|regarding)\s+['"]?(\w[\w\s]*?)['"]?\s*$/i, build: (m) => ({ query: `short_descriptionLIKE${m[1]}^ORdescriptionLIKE${m[1]}` }) },
  // "P1" / "P2" etc.
  { regex: /\bP([1-5])\b/, build: (m) => ({ query: `priority=${m[1]}` }) },
];

function translateNL(nlQuery: string): { query: string; suggestedTable?: string } {
  const parts: string[] = [];
  let suggestedTable: string | undefined;

  for (const pattern of NL_PATTERNS) {
    const match = nlQuery.match(pattern.regex);
    if (match) {
      const result = pattern.build(match);
      parts.push(result.query);
      if (result.table) suggestedTable = result.table;
    }
  }

  if (parts.length === 0) {
    // Fallback: search short_description for the whole query
    parts.push(`short_descriptionLIKE${nlQuery}`);
  }

  return { query: parts.join("^"), suggestedTable };
}

export function registerSearchTools(server: McpServer, registry: InstanceRegistry): void {

  server.registerTool(
    "sn_natural_language_search",
    {
      description: "Search ServiceNow using plain English. Translates natural language into encoded queries. Examples: 'high priority incidents assigned to me', 'emergency changes created this week', 'open problems from network team'.",
      inputSchema: {
        instance: z.string().optional().describe("Target ServiceNow instance name (from config). Uses default instance if omitted."),
        table: z.string().optional().describe("Table to search (auto-detected if possible, defaults to 'incident')"),
        nl_query: z.string().describe("Natural language query (e.g. 'active high priority incidents assigned to admin')"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ instance, table, nl_query, limit }) => {
      const client = registry.resolve(instance);
      const { query, suggestedTable } = translateNL(nl_query);
      const targetTable = table ?? suggestedTable ?? "incident";

      const result = await client.queryTable(targetTable, {
        sysparm_query: query + "^ORDERBYDESCsys_created_on",
        sysparm_limit: limit,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            table: targetTable,
            translated_query: query,
            count: result.records.length,
            records: result.records,
          }, null, 2),
        }],
      };
    }
  );
}
