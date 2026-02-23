/**
 * stderr-safe logger.
 * CRITICAL: MCP stdio transport uses stdout for JSON-RPC messages.
 * ALL logging MUST go to stderr to avoid corrupting the protocol.
 */

let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug(...args: unknown[]): void {
    if (debugEnabled) {
      console.error(`[${timestamp()}] [DEBUG]`, ...args);
    }
  },

  info(...args: unknown[]): void {
    console.error(`[${timestamp()}] [INFO]`, ...args);
  },

  warn(...args: unknown[]): void {
    console.error(`[${timestamp()}] [WARN]`, ...args);
  },

  error(...args: unknown[]): void {
    console.error(`[${timestamp()}] [ERROR]`, ...args);
  },
};
