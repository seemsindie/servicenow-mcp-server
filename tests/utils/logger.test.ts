import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test";
import { logger, setDebug } from "../../src/utils/logger.ts";

describe("logger", () => {
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
    setDebug(false);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test("info() writes to stderr via console.error", () => {
    logger.info("test message");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const call = errorSpy.mock.calls[0]!;
    expect(call[0]).toMatch(/\[.*\] \[INFO\]/);
    expect(call[1]).toBe("test message");
  });

  test("warn() writes to stderr", () => {
    logger.warn("warning!");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const call = errorSpy.mock.calls[0]!;
    expect(call[0]).toMatch(/\[WARN\]/);
  });

  test("error() writes to stderr", () => {
    logger.error("something broke");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const call = errorSpy.mock.calls[0]!;
    expect(call[0]).toMatch(/\[ERROR\]/);
  });

  test("debug() does NOT write when debug is disabled", () => {
    setDebug(false);
    logger.debug("should not appear");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("debug() writes when debug is enabled", () => {
    setDebug(true);
    logger.debug("debug msg");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const call = errorSpy.mock.calls[0]!;
    expect(call[0]).toMatch(/\[DEBUG\]/);
    expect(call[1]).toBe("debug msg");
  });

  test("timestamp is ISO 8601 format", () => {
    logger.info("ts check");
    const call = errorSpy.mock.calls[0]![0] as string;
    // Extract timestamp from "[2025-01-15T10:00:00.000Z] [INFO]"
    const tsMatch = call.match(/\[(.+?)\]/);
    expect(tsMatch).not.toBeNull();
    const ts = tsMatch![1]!;
    expect(new Date(ts).toISOString()).toBe(ts);
  });
});
