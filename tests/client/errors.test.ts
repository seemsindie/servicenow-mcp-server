import { describe, expect, test } from "bun:test";
import {
  ServiceNowError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  mapResponseError,
} from "../../src/client/errors.ts";

describe("Error classes", () => {
  test("ServiceNowError has correct properties", () => {
    const err = new ServiceNowError("test", 500, "detail");
    expect(err.message).toBe("test");
    expect(err.status).toBe(500);
    expect(err.detail).toBe("detail");
    expect(err.name).toBe("ServiceNowError");
    expect(err).toBeInstanceOf(Error);
  });

  test("BadRequestError defaults to 400", () => {
    const err = new BadRequestError("bad field");
    expect(err.status).toBe(400);
    expect(err.name).toBe("BadRequestError");
    expect(err).toBeInstanceOf(ServiceNowError);
  });

  test("UnauthorizedError defaults to 401", () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.name).toBe("UnauthorizedError");
  });

  test("ForbiddenError defaults to 403", () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.name).toBe("ForbiddenError");
  });

  test("NotFoundError defaults to 404", () => {
    const err = new NotFoundError("no such record");
    expect(err.status).toBe(404);
    expect(err.detail).toBe("no such record");
  });

  test("ConflictError defaults to 409", () => {
    const err = new ConflictError();
    expect(err.status).toBe(409);
  });

  test("RateLimitError defaults to 429", () => {
    const err = new RateLimitError();
    expect(err.status).toBe(429);
  });
});

describe("mapResponseError", () => {
  test("maps 400 to BadRequestError", () => {
    const err = mapResponseError(400, "bad");
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.status).toBe(400);
  });

  test("maps 401 to UnauthorizedError", () => {
    const err = mapResponseError(401, "no auth");
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  test("maps 403 to ForbiddenError", () => {
    const err = mapResponseError(403, "forbidden");
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  test("maps 404 to NotFoundError", () => {
    const err = mapResponseError(404, "not found");
    expect(err).toBeInstanceOf(NotFoundError);
  });

  test("maps 409 to ConflictError", () => {
    const err = mapResponseError(409, "conflict");
    expect(err).toBeInstanceOf(ConflictError);
  });

  test("maps 429 to RateLimitError", () => {
    const err = mapResponseError(429, "too many");
    expect(err).toBeInstanceOf(RateLimitError);
  });

  test("maps unknown status to generic ServiceNowError", () => {
    const err = mapResponseError(503, "unavailable");
    expect(err).toBeInstanceOf(ServiceNowError);
    expect(err.status).toBe(503);
    expect(err.detail).toBe("unavailable");
  });

  test("extracts error.message from JSON body", () => {
    const body = JSON.stringify({ error: { message: "Record not found", detail: "sys_id invalid" } });
    const err = mapResponseError(404, body);
    expect(err.detail).toBe("Record not found");
  });

  test("extracts error.detail when error.message is absent", () => {
    const body = JSON.stringify({ error: { detail: "Field is mandatory" } });
    const err = mapResponseError(400, body);
    expect(err.detail).toBe("Field is mandatory");
  });

  test("extracts top-level message", () => {
    const body = JSON.stringify({ message: "General error" });
    const err = mapResponseError(500, body);
    expect(err.detail).toBe("General error");
  });

  test("falls back to raw body for non-JSON", () => {
    const err = mapResponseError(500, "Internal Server Error");
    expect(err.detail).toBe("Internal Server Error");
  });
});
