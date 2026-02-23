# ServiceNow MCP Server

A comprehensive [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for ServiceNow, built with **Bun** and **TypeScript**. Exposes 93 tools across 15 ServiceNow domains, 7 read-only resources, and role-based tool packages. Supports **multi-instance** configurations with per-call instance targeting.

## Features

- **93 MCP tools** covering incidents, changes, catalog, CMDB, users, knowledge, workflows, scripts, update sets, agile, schema discovery, natural language search, batch operations, and instance management
- **Multi-instance support** — configure multiple ServiceNow instances (dev/test/prod) with per-instance auth; target any instance per tool call via the `instance` parameter
- **7 MCP resources** — read-only `servicenow://` URIs for incidents, users, knowledge, tables, schema
- **8 tool packages** — role-based subsets (service desk, change coordinator, platform developer, etc.)
- **Two transports** — stdio (for Claude Desktop / Claude Code) and Streamable HTTP (for web integrations)
- **Basic & OAuth 2.0 auth** with automatic token refresh, configured per instance
- **Single JSON config file** — no env vars, one source of truth

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- A ServiceNow instance with REST API access

### Install & Configure

```bash
git clone <this-repo>
cd servicenow-mcp-server
bun install

# Create your config file
cp config/servicenow-config.example.json config/servicenow-config.json
# Edit with your instance details and credentials
```

### Run (stdio transport)

```bash
bun run start
# or with explicit config path:
bun run start -- --config /path/to/config.json
```

### Run (HTTP transport)

```bash
bun run start:http
# or:
bun run start:http -- --config /path/to/config.json

# Server starts at http://127.0.0.1:3000
# Health check: GET /health
# MCP endpoint: /mcp
```

## Configuration

All configuration lives in a single JSON file. The server searches for it in order:

1. `config/servicenow-config.json` (relative to cwd)
2. `servicenow-config.json` (relative to cwd)

Or specify an explicit path with `--config`:

```bash
bun run src/index.ts --config /etc/servicenow/config.json
```

### Config File Format

```json
{
  "instances": [
    {
      "name": "dev",
      "url": "https://dev-instance.service-now.com",
      "auth": {
        "type": "basic",
        "username": "admin",
        "password": "dev-password"
      },
      "default": true,
      "description": "Development instance"
    },
    {
      "name": "prod",
      "url": "https://prod-instance.service-now.com",
      "auth": {
        "type": "oauth",
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret",
        "username": "admin",
        "password": "prod-password"
      },
      "description": "Production instance"
    }
  ],
  "toolPackage": "full",
  "debug": false,
  "http": {
    "port": 3000,
    "host": "127.0.0.1"
  }
}
```

### Config Reference

| Field | Required | Default | Description |
|---|---|---|---|
| `instances` | Yes | — | Array of ServiceNow instance configs |
| `instances[].name` | Yes | — | Unique identifier (used in `instance` parameter) |
| `instances[].url` | Yes | — | ServiceNow instance URL |
| `instances[].auth` | Yes | — | Auth config (`basic` or `oauth`) |
| `instances[].default` | No | `false` | Mark as default (at most one) |
| `instances[].description` | No | — | Human-readable description |
| `toolPackage` | No | `"full"` | Tool package filter (see below) |
| `debug` | No | `false` | Enable debug logging |
| `http.port` | No | `3000` | HTTP transport port |
| `http.host` | No | `"127.0.0.1"` | HTTP transport bind address |

### Auth Types

**Basic auth:**
```json
{ "type": "basic", "username": "admin", "password": "secret" }
```

**OAuth 2.0:**
```json
{
  "type": "oauth",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "username": "admin",
  "password": "secret"
}
```

Each instance independently specifies its own auth type and credentials.

## Using Multiple Instances

Every tool accepts an optional `instance` parameter. When omitted, the default instance is used.

```
# Query incidents on the default instance
sn_query_table(table: "incident", query: "active=true")

# Query incidents on a specific instance
sn_query_table(table: "incident", query: "active=true", instance: "prod")

# List all configured instances
sn_list_instances()

# Get info about a specific instance
sn_instance_info(instance: "dev")
```

MCP resources (`servicenow://` URIs) always use the default instance.

## Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "servicenow": {
      "command": "bun",
      "args": ["run", "/path/to/servicenow-mcp-server/src/index.ts"]
    }
  }
}
```

Place your `config/servicenow-config.json` in the project directory. Or use `--config` to point elsewhere:

```json
{
  "mcpServers": {
    "servicenow": {
      "command": "bun",
      "args": [
        "run", "/path/to/servicenow-mcp-server/src/index.ts",
        "--config", "/path/to/servicenow-config.json"
      ]
    }
  }
}
```

## Tool Packages

Limit exposed tools by role. Set `toolPackage` in your config file:

| Package | Modules | Use Case |
|---|---|---|
| `full` | All 14 modules (91 tools) + instance tools | Full access |
| `service_desk` | tables, incidents, users, knowledge, search | Service desk agents |
| `change_coordinator` | tables, changes, users, search | Change management |
| `catalog_builder` | tables, catalog, search | Catalog administration |
| `knowledge_author` | tables, knowledge, search | KB content creation |
| `platform_developer` | tables, scripts, workflows, changesets, schema, search | Platform development |
| `system_admin` | tables, users, schema, search, batch | System administration |
| `agile` | tables, agile, users, search | Agile teams |

Instance management tools (`sn_list_instances`, `sn_instance_info`) are always available regardless of package.

## Tools Reference

### Instance Management (2 tools) — always available
`sn_list_instances`, `sn_instance_info`

### Generic Table API (5 tools)
`sn_query_table`, `sn_get_record`, `sn_create_record`, `sn_update_record`, `sn_delete_record`

### Incidents (7 tools)
`sn_list_incidents`, `sn_create_incident`, `sn_update_incident`, `sn_add_incident_comment`, `sn_add_incident_work_notes`, `sn_resolve_incident`, `sn_close_incident`

### Users & Groups (9 tools)
`sn_list_users`, `sn_get_user`, `sn_create_user`, `sn_update_user`, `sn_list_groups`, `sn_create_group`, `sn_update_group`, `sn_add_group_members`, `sn_remove_group_members`

### Change Management (10 tools)
`sn_list_change_requests`, `sn_get_change_request`, `sn_create_change_request`, `sn_update_change_request`, `sn_add_change_task`, `sn_submit_change_for_approval`, `sn_approve_change`, `sn_reject_change`, `sn_add_change_comment`, `sn_add_change_work_notes`

### Service Catalog (12 tools)
`sn_list_catalogs`, `sn_list_catalog_items`, `sn_get_catalog_item`, `sn_update_catalog_item`, `sn_list_catalog_categories`, `sn_create_catalog_category`, `sn_update_catalog_category`, `sn_move_catalog_items`, `sn_create_catalog_variable`, `sn_list_catalog_variables`, `sn_update_catalog_variable`, `sn_get_catalog_recommendations`

### Knowledge Base (8 tools)
`sn_list_knowledge_bases`, `sn_create_knowledge_base`, `sn_create_kb_category`, `sn_list_articles`, `sn_get_article`, `sn_create_article`, `sn_update_article`, `sn_publish_article`

### Workflows (5 tools)
`sn_list_workflows`, `sn_get_workflow`, `sn_create_workflow`, `sn_update_workflow`, `sn_delete_workflow`

### Script Includes (5 tools)
`sn_list_script_includes`, `sn_get_script_include`, `sn_create_script_include`, `sn_update_script_include`, `sn_delete_script_include`

### Update Sets (7 tools)
`sn_list_update_sets`, `sn_get_update_set`, `sn_create_update_set`, `sn_update_update_set`, `sn_set_current_update_set`, `sn_commit_update_set`, `sn_add_to_update_set`

### Agile (12 tools)
`sn_list_stories`, `sn_create_story`, `sn_update_story`, `sn_list_epics`, `sn_create_epic`, `sn_update_epic`, `sn_list_scrum_tasks`, `sn_create_scrum_task`, `sn_update_scrum_task`, `sn_list_projects`, `sn_create_project`, `sn_update_project`

### CMDB (5 tools)
`sn_list_ci`, `sn_get_ci`, `sn_create_ci`, `sn_list_ci_relationships`, `sn_create_ci_relationship`

### Schema Discovery (3 tools)
`sn_get_table_schema`, `sn_discover_table`, `sn_list_tables`

### Natural Language Search (1 tool)
`sn_natural_language_search` — translates plain English to ServiceNow encoded queries

### Batch Operations (2 tools)
`sn_batch_create`, `sn_batch_update` — parallel record creation/updates across tables

## MCP Resources

Resources always use the default instance.

| URI | Description |
|---|---|
| `servicenow://incidents` | 20 most recent incidents |
| `servicenow://users` | Active users (limit 50) |
| `servicenow://knowledge` | Published knowledge articles |
| `servicenow://tables` | Available table definitions |
| `servicenow://tables/{table}` | Records from any table |
| `servicenow://schema/{table}` | Table schema (fields, types) |
| `servicenow://incidents/{number}` | Specific incident by number |

## Development

```bash
# Type check
bun run typecheck

# Run tests
bun test

# Dev mode (auto-reload)
bun run dev
```

## Architecture

```
src/
  index.ts          # stdio entry point (--config support)
  http.ts           # Streamable HTTP entry point (--config support)
  server.ts         # MCP server setup, modular tool registration
  config.ts         # JSON config loader + Zod validation
  auth/             # Basic & OAuth providers (per-instance)
  client/
    index.ts        # ServiceNow REST client
    registry.ts     # InstanceRegistry — maps instance names to clients
    errors.ts       # SN-specific error classes
    types.ts        # API response types
  tools/            # 14 domain tool modules + instance management
  resources/        # 7 servicenow:// MCP resources (default instance)
  packages/         # 8 role-based tool package definitions
  utils/            # Logger (stderr-safe), encoded query builder

config/
  servicenow-config.example.json  # Config template
```

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `zod` — Schema validation

## License

MIT
