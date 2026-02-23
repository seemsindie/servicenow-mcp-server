import { logger } from "../utils/logger.ts";
import { TOOL_PACKAGES } from "./definitions.ts";

/**
 * Returns a Set of allowed module keys for the given package name,
 * or null if all modules should be loaded (i.e. "full" package).
 */
export function getPackageToolFilter(packageName: string): Set<string> | null {
  if (packageName === "full") {
    return null; // null = load everything
  }

  const modules = TOOL_PACKAGES[packageName];
  if (!modules) {
    logger.warn(
      `Unknown tool package "${packageName}", falling back to "full". ` +
      `Available packages: ${Object.keys(TOOL_PACKAGES).join(", ")}`
    );
    return null;
  }

  return new Set(modules);
}
