/**
 * Shared test helpers and mock factories for ServiceNow MCP server tests.
 */

import type { AuthProvider } from "../../src/auth/types.ts";
import type { SNPaginatedResult, SNRecord } from "../../src/client/types.ts";
import type { InstanceRegistry, InstanceInfo } from "../../src/client/registry.ts";

// ── Mock AuthProvider ─────────────────────────────────────

export function createMockAuth(headers: Record<string, string> = { Authorization: "Basic dGVzdDp0ZXN0" }): AuthProvider {
  return {
    name: "mock",
    getHeaders: async () => ({ ...headers }),
  };
}

// ── Mock ServiceNowClient ─────────────────────────────────

export interface MockClientCalls {
  queryTable: Array<{ tableName: string; params: unknown }>;
  getRecord: Array<{ tableName: string; sysId: string; params: unknown }>;
  createRecord: Array<{ tableName: string; body: Record<string, unknown> }>;
  updateRecord: Array<{ tableName: string; sysId: string; body: Record<string, unknown> }>;
  deleteRecord: Array<{ tableName: string; sysId: string }>;
  requestRaw: Array<{ method: string; path: string; body?: Record<string, unknown> }>;
}

export interface MockClient {
  queryTable: (tableName: string, params?: unknown) => Promise<SNPaginatedResult>;
  getRecord: (tableName: string, sysId: string, params?: unknown) => Promise<SNRecord>;
  createRecord: (tableName: string, body: Record<string, unknown>) => Promise<SNRecord>;
  updateRecord: (tableName: string, sysId: string, body: Record<string, unknown>) => Promise<SNRecord>;
  deleteRecord: (tableName: string, sysId: string) => Promise<void>;
  requestRaw: (method: string, path: string, body?: Record<string, unknown>) => Promise<Response>;
  _calls: MockClientCalls;
}

export function createMockClient(overrides: Partial<{
  queryTableResult: SNPaginatedResult;
  getRecordResult: SNRecord;
  createRecordResult: SNRecord;
  updateRecordResult: SNRecord;
  requestRawResult: Response;
}> = {}): MockClient {
  const calls: MockClientCalls = {
    queryTable: [],
    getRecord: [],
    createRecord: [],
    updateRecord: [],
    deleteRecord: [],
    requestRaw: [],
  };

  const defaultPaginatedResult: SNPaginatedResult = {
    records: [],
    pagination: { limit: 10, offset: 0, hasMore: false },
  };

  const defaultRecord: SNRecord = {
    sys_id: "abc123def456abc123def456abc12345",
    number: "INC0010001",
    short_description: "Test record",
  };

  return {
    queryTable: async (tableName: string, params?: unknown) => {
      calls.queryTable.push({ tableName, params });
      return overrides.queryTableResult ?? { ...defaultPaginatedResult };
    },
    getRecord: async (tableName: string, sysId: string, params?: unknown) => {
      calls.getRecord.push({ tableName, sysId, params });
      return overrides.getRecordResult ?? { ...defaultRecord };
    },
    createRecord: async (tableName: string, body: Record<string, unknown>) => {
      calls.createRecord.push({ tableName, body });
      return overrides.createRecordResult ?? { ...defaultRecord, ...body };
    },
    updateRecord: async (tableName: string, sysId: string, body: Record<string, unknown>) => {
      calls.updateRecord.push({ tableName, sysId, body });
      return overrides.updateRecordResult ?? { ...defaultRecord, sys_id: sysId, ...body };
    },
    deleteRecord: async (tableName: string, sysId: string) => {
      calls.deleteRecord.push({ tableName, sysId });
    },
    requestRaw: async (method: string, path: string, body?: Record<string, unknown>) => {
      calls.requestRaw.push({ method, path, body });
      return overrides.requestRawResult ?? new Response(JSON.stringify({ result: {} }), { status: 200 });
    },
    _calls: calls,
  };
}

// ── Mock fetch helper ─────────────────────────────────────

export function mockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// ── Sample data ───────────────────────────────────────────

export const SAMPLE_INCIDENT: SNRecord = {
  sys_id: "abc123def456abc123def456abc12345",
  number: "INC0010001",
  short_description: "Cannot access email",
  state: "1",
  priority: "2",
  urgency: "2",
  impact: "2",
  assigned_to: "admin",
  assignment_group: "Service Desk",
  category: "Network",
  opened_at: "2025-01-15 10:00:00",
};

export const SAMPLE_USER: SNRecord = {
  sys_id: "usr123def456abc123def456abc12345",
  user_name: "admin",
  first_name: "System",
  last_name: "Administrator",
  email: "admin@example.com",
  active: "true",
};

export const SAMPLE_CHANGE: SNRecord = {
  sys_id: "chg123def456abc123def456abc12345",
  number: "CHG0010001",
  short_description: "Upgrade database",
  type: "normal",
  state: "-5",
  risk: "3",
};

// ── Mock InstanceRegistry ─────────────────────────────────

export interface MockRegistry {
  resolve: (instanceName?: string) => MockClient;
  getDefaultName: () => string;
  listInstances: () => InstanceInfo[];
  getInstanceInfo: (instanceName?: string) => InstanceInfo;
  size: number;
  /** The underlying mock client returned by resolve() */
  _client: MockClient;
}

/**
 * Creates a mock InstanceRegistry that wraps a single mock client.
 * All `resolve()` calls return the same mock client, making it easy
 * to inspect calls in tests.
 */
export function createMockRegistry(
  clientOverrides: Parameters<typeof createMockClient>[0] = {},
  options: { defaultName?: string; instances?: InstanceInfo[] } = {}
): MockRegistry {
  const mockClient = createMockClient(clientOverrides);
  const defaultName = options.defaultName ?? "default";
  const instances: InstanceInfo[] = options.instances ?? [
    { name: defaultName, url: "https://test.service-now.com", isDefault: true },
  ];

  return {
    resolve: (_instanceName?: string) => mockClient,
    getDefaultName: () => defaultName,
    listInstances: () => instances,
    getInstanceInfo: (instanceName?: string) => {
      const name = instanceName ?? defaultName;
      const found = instances.find((i) => i.name === name);
      if (!found) throw new Error(`Unknown instance: "${name}"`);
      return found;
    },
    size: instances.length,
    _client: mockClient,
  };
}
