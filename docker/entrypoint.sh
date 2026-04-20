#!/bin/sh
# Render servicenow-config.json from env vars, then exec the HTTP server.
#
# Required env vars (single instance):
#   SN_INSTANCE_URL    e.g. https://dev12345.service-now.com
#   SN_AUTH_TYPE       "basic" | "oauth"
#
# Basic auth:
#   SN_USERNAME, SN_PASSWORD
#
# OAuth (Resource Owner Password grant):
#   SN_OAUTH_CLIENT_ID, SN_OAUTH_CLIENT_SECRET, SN_USERNAME, SN_PASSWORD
#
# Optional:
#   SN_INSTANCE_NAME    (default: "default")
#   SN_TOOL_PACKAGE     (default: "full")
#   SN_DEBUG            (default: "false")
#   MCP_HTTP_HOST       (default: "0.0.0.0")
#   MCP_HTTP_PORT       (default: "3000")
#
# For multi-instance setups, mount a prebuilt JSON at /app/config/servicenow-config.json
# and the renderer is skipped.

set -eu

CONFIG_PATH="${CONFIG_PATH:-/app/config/servicenow-config.json}"

if [ -s "$CONFIG_PATH" ]; then
  echo "[entrypoint] Using existing config at $CONFIG_PATH"
else
  : "${SN_INSTANCE_URL:?SN_INSTANCE_URL is required when no config file is mounted}"
  : "${SN_AUTH_TYPE:?SN_AUTH_TYPE is required (basic|oauth)}"

  SN_INSTANCE_NAME="${SN_INSTANCE_NAME:-default}"
  SN_TOOL_PACKAGE="${SN_TOOL_PACKAGE:-full}"
  SN_DEBUG="${SN_DEBUG:-false}"
  MCP_HTTP_HOST="${MCP_HTTP_HOST:-0.0.0.0}"
  MCP_HTTP_PORT="${MCP_HTTP_PORT:-3000}"

  case "$SN_AUTH_TYPE" in
    basic)
      : "${SN_USERNAME:?SN_USERNAME required for basic auth}"
      : "${SN_PASSWORD:?SN_PASSWORD required for basic auth}"
      AUTH_JSON=$(printf '{"type":"basic","username":%s,"password":%s}' \
        "$(printf '%s' "$SN_USERNAME" | jq -Rs .)" \
        "$(printf '%s' "$SN_PASSWORD" | jq -Rs .)")
      ;;
    oauth)
      : "${SN_OAUTH_CLIENT_ID:?SN_OAUTH_CLIENT_ID required for oauth}"
      : "${SN_OAUTH_CLIENT_SECRET:?SN_OAUTH_CLIENT_SECRET required for oauth}"
      : "${SN_USERNAME:?SN_USERNAME required for oauth}"
      : "${SN_PASSWORD:?SN_PASSWORD required for oauth}"
      AUTH_JSON=$(printf '{"type":"oauth","clientId":%s,"clientSecret":%s,"username":%s,"password":%s}' \
        "$(printf '%s' "$SN_OAUTH_CLIENT_ID" | jq -Rs .)" \
        "$(printf '%s' "$SN_OAUTH_CLIENT_SECRET" | jq -Rs .)" \
        "$(printf '%s' "$SN_USERNAME" | jq -Rs .)" \
        "$(printf '%s' "$SN_PASSWORD" | jq -Rs .)")
      ;;
    *)
      echo "[entrypoint] Unknown SN_AUTH_TYPE: $SN_AUTH_TYPE (must be basic or oauth)" >&2
      exit 1
      ;;
  esac

  mkdir -p "$(dirname "$CONFIG_PATH")"
  jq -n \
    --arg name "$SN_INSTANCE_NAME" \
    --arg url "$SN_INSTANCE_URL" \
    --argjson auth "$AUTH_JSON" \
    --arg toolPackage "$SN_TOOL_PACKAGE" \
    --argjson debug "$SN_DEBUG" \
    --arg host "$MCP_HTTP_HOST" \
    --argjson port "$MCP_HTTP_PORT" \
    '{
      instances: [{ name: $name, url: $url, auth: $auth, default: true }],
      toolPackage: $toolPackage,
      debug: $debug,
      http: { host: $host, port: $port }
    }' > "$CONFIG_PATH"

  echo "[entrypoint] Rendered config for instance '$SN_INSTANCE_NAME' ($SN_AUTH_TYPE auth)"
fi

exec bun run src/http.ts --config "$CONFIG_PATH"
