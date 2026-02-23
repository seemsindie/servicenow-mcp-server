# ServiceNow MCP Server

A comprehensive [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for ServiceNow, built with **Bun** and **TypeScript**. Exposes 93 tools across 15 ServiceNow domains, 7 read-only resources, and role-based tool packages. Supports **multi-instance** configurations with per-call instance targeting.

## Features

- **93 MCP tools** covering incidents, changes, catalog, CMDB, users, knowledge, workflows, scripts, update sets, agile, schema discovery, natural language search, batch operations, and instance management
- **Multi-instance support** — configure multiple ServiceNow instances (dev/test/prod) with per-instance auth; target any instance per tool call via the `instance` parameter
- **7 MCP resources** — read-only `servicenow://` URIs for incidents, users, knowledge, tables, schema
- **8 tool packages** — role-based subsets (service desk, change coordinator, platform developer, etc.)
- **Two transports** — stdio (for Claude Desktop / Claude Code) and Streamable HTTP (for web integrations)
- **Basic & OAuth 2.0 auth** with automatic token refresh, configured per instance
- **Zod-validated config** with clear error messages

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- A ServiceNow instance with REST API access

### Install & Configure

```bash
git clone <this-repo>
cd servicenow-mcp-server
bun install
```

**Option A: Single instance via environment variables** (simplest)

```bash
cp .env.example .env
# Edit .env with your ServiceNow instance URL and credentials
```

**Option B: Multi-instance via JSON config** (recommended for multiple instances)

```bash
cp config/servicenow-instances.example.json config/servicenow-instances.json
# Edit with your instance details
```

### Run (stdio transport)

```bash
bun run start
```

### Run (HTTP transport)

```bash
bun run start:http
# Server starts at http://127.0.0.1:3000
# Health check: GET /health
# MCP endpoint: /mcp
```

## Configuration

### Multi-Instance Configuration (JSON file)

Create `config/servicenow-instances.json` (or `servicenow-instances.json` in the project root):

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
      "name": "test",
      "url": "https://test-instance.service-now.com",
      "auth": {
        "type": "oauth",
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret",
        "username": "admin",
        "password": "test-password"
      },
      "description": "Test/QA instance"
    },
    {
      "name": "prod",
      "url": "https://prod-instance.service-now.com",
      "auth": {
        "type": "basic",
        "username": "readonly-user",
        "password": "prod-password"
      },
      "description": "Production instance (read-only user)"
    }
  ]
}
```

Each instance specifies:
- `name` — unique identifier used in the `instance` parameter on tool calls
- `url` — ServiceNow instance URL
- `auth` — authentication config (`basic` or `oauth`), independent per instance
- `default` — (optional) mark one instance as default; first instance is used if none marked
- `description` — (optional) human-readable description

### Single-Instance Configuration (Environment Variables)

If no JSON config file is found, the server falls back to environment variables for backward compatibility:

| Variable | Required | Default | Description |
|---|---|---|---|
| `SERVICENOW_INSTANCE_URL` | Yes | — | Your ServiceNow instance URL |
| `SERVICENOW_AUTH_TYPE` | No | `basic` | `basic` or `oauth` |
| `SERVICENOW_USERNAME` | Yes* | — | Username (basic auth or OAuth resource owner) |
| `SERVICENOW_PASSWORD` | Yes* | — | Password |
| `SERVICENOW_CLIENT_ID` | Yes** | — | OAuth client ID |
| `SERVICENOW_CLIENT_SECRET` | Yes** | — | OAuth client secret |

\* Required for basic auth
\*\* Required for OAuth

### General Settings (Environment Variables)

These apply regardless of which config method you use:

| Variable | Default | Description |
|---|---|---|
| `SN_TOOL_PACKAGE` | `full` | Tool package (see below) |
| `SN_DEBUG` | `false` | Enable debug logging |
| `SN_HTTP_PORT` | `3000` | HTTP transport port |
| `SN_HTTP_HOST` | `127.0.0.1` | HTTP transport host |

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

**Single instance (env vars):**

```json
{
  "mcpServers": {
    "servicenow": {
      "command": "bun",
      "args": ["run", "/path/to/servicenow-mcp-server/src/index.ts"],
      "env": {
        "SERVICENOW_INSTANCE_URL": "https://your-instance.service-now.com",
        "SERVICENOW_USERNAME": "admin",
        "SERVICENOW_PASSWORD": "your-password",
        "SN_TOOL_PACKAGE": "service_desk"
      }
    }
  }
}
```

**Multi-instance (JSON config file):**

```json
{
  "mcpServers": {
    "servicenow": {
      "command": "bun",
      "args": ["run", "/path/to/servicenow-mcp-server/src/index.ts"],
      "env": {
        "SN_TOOL_PACKAGE": "full"
      }
    }
  }
}
```

Place your `config/servicenow-instances.json` in the project directory.

## Tool Packages

Limit exposed tools by role. Set `SN_TOOL_PACKAGE` to one of:

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

Note: Instance management tools (`sn_list_instances`, `sn_instance_info`) are always available regardless of package selection.

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
  index.ts          # stdio entry point
  http.ts           # Streamable HTTP entry point
  server.ts         # MCP server setup, modular tool registration
  config.ts         # Zod-validated config (JSON file + env var fallback)
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
  servicenow-instances.example.json  # Multi-instance config template
```

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `zod` — Schema validation

## License

MIT
