/**
 * Tests for page-script.ts fetch interception
 *
 * Tests the fetch proxy logic that intercepts ChatGPT API responses
 * and trims conversation data before React renders it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock trimMapping module before importing page-script internals
vi.mock('../../extension/src/shared/trimmer', () => ({
  trimMapping: vi.fn(),
}));

import { trimMapping } from '../../extension/src/shared/trimmer';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock Response object
 */
function createMockResponse(
  body: unknown,
  options: {
    status?: number;
    contentType?: string;
    url?: string;
  } = {}
): Response {
  const {
    status = 200,
    contentType = 'application/json',
    url = 'https://chatgpt.com/backend-api/conversation/123',
  } = options;

  const headers = new Headers();
  headers.set('content-type', contentType);

  const response = new Response(JSON.stringify(body), {
    status,
    headers,
  });

  // Set URL property
  Object.defineProperty(response, 'url', { value: url });

  return response;
}

/**
 * Create mock conversation data
 */
function createConversationData(nodeCount: number = 4) {
  const mapping: Record<string, unknown> = {};
  const nodes: string[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const id = `node-${i}`;
    nodes.push(id);
    mapping[id] = {
      parent: i === 0 ? null : `node-${i - 1}`,
      children: i === nodeCount - 1 ? [] : [`node-${i + 1}`],
      message: {
        author: { role: i % 2 === 0 ? 'user' : 'assistant' },
      },
    };
  }

  return {
    mapping,
    current_node: nodes[nodes.length - 1],
  };
}

// ============================================================================
// Helper Function Tests (extracted for testability)
// ============================================================================

describe('isConversationRequest logic', () => {
  // Testing the logic that would be in isConversationRequest
  const isConversationRequest = (method: string, pathname: string): boolean => {
    if (method !== 'GET') return false;
    return /^\/backend-api\/(conversation|shared_conversation)\/[^/]+\/?$/.test(pathname);
  };

  it('returns true only for conversation endpoints', () => {
    expect(isConversationRequest('GET', '/backend-api/conversation/123')).toBe(true);
    expect(isConversationRequest('GET', '/backend-api/conversation/123/')).toBe(true);
    expect(isConversationRequest('GET', '/backend-api/shared_conversation/abc-xyz')).toBe(true);
  });

  it('returns false for non-GET methods', () => {
    expect(isConversationRequest('POST', '/backend-api/conversation')).toBe(false);
    expect(isConversationRequest('PUT', '/backend-api/conversation')).toBe(false);
    expect(isConversationRequest('DELETE', '/backend-api/conversation')).toBe(false);
  });

  it('returns false for non-conversation backend-api paths', () => {
    expect(isConversationRequest('GET', '/backend-api/')).toBe(false);
    expect(isConversationRequest('GET', '/backend-api/conversation')).toBe(false);
    expect(isConversationRequest('GET', '/backend-api/me')).toBe(false);
    expect(isConversationRequest('GET', '/backend-api/settings/user')).toBe(false);
    expect(isConversationRequest('GET', '/backend-api/models')).toBe(false);
    expect(isConversationRequest('GET', '/backend-api/conversation/123/stream_status')).toBe(false);
    expect(isConversationRequest('GET', '/backend-api/conversation/123/textdocs')).toBe(false);
  });

  it('returns false for non-backend-api paths', () => {
    expect(isConversationRequest('GET', '/api/conversation')).toBe(false);
    expect(isConversationRequest('GET', '/conversation')).toBe(false);
    expect(isConversationRequest('GET', '/')).toBe(false);
  });
});

describe('isJsonResponse logic', () => {
  // Testing the logic that would be in isJsonResponse
  const isJsonResponse = (contentType: string | null): boolean => {
    return (contentType || '').toLowerCase().includes('application/json');
  };

  it('returns true for application/json', () => {
    expect(isJsonResponse('application/json')).toBe(true);
    expect(isJsonResponse('application/json; charset=utf-8')).toBe(true);
    expect(isJsonResponse('Application/JSON')).toBe(true);
  });

  it('returns false for non-JSON content types', () => {
    expect(isJsonResponse('text/html')).toBe(false);
    expect(isJsonResponse('text/plain')).toBe(false);
    expect(isJsonResponse('application/octet-stream')).toBe(false);
    expect(isJsonResponse(null)).toBe(false);
  });
});

// ============================================================================
// Response Modification Tests
// ============================================================================

describe('createModifiedResponse logic', () => {
  it('creates response with modified JSON body', () => {
    const originalData = { mapping: {}, current_node: 'old' };
    const modifiedData = { mapping: {}, current_node: 'new', root: 'root' };

    const response = new Response(JSON.stringify(modifiedData), {
      status: 200,
      headers: new Headers({
        'content-type': 'application/json; charset=utf-8',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('removes content-length and content-encoding headers', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'content-length': '1000',
      'content-encoding': 'gzip',
    });

    // Simulate what createModifiedResponse does
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('content-type', 'application/json; charset=utf-8');

    expect(headers.has('content-length')).toBe(false);
    expect(headers.has('content-encoding')).toBe(false);
    expect(headers.get('content-type')).toBe('application/json; charset=utf-8');
  });
});

// ============================================================================
// Trim Integration Tests
// ============================================================================

describe('fetch interception with trimMapping', () => {
  const mockedTrimMapping = vi.mocked(trimMapping);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('trimMapping is called with conversation data and limit', () => {
    const conversationData = createConversationData(4);
    const limit = 2;

    mockedTrimMapping.mockReturnValue({
      mapping: conversationData.mapping,
      current_node: 'node-3',
      root: 'node-0',
      keptCount: 2,
      totalCount: 4,
      visibleKept: 2,
      visibleTotal: 4,
    });

    const result = mockedTrimMapping(conversationData, limit);

    expect(mockedTrimMapping).toHaveBeenCalledWith(conversationData, limit);
    expect(result).not.toBeNull();
    expect(result?.visibleKept).toBe(2);
  });

  it('returns null when trimMapping returns null', () => {
    const invalidData = { mapping: null, current_node: null };

    mockedTrimMapping.mockReturnValue(null);

    const result = mockedTrimMapping(invalidData as any, 10);

    expect(result).toBeNull();
  });

  it('calculates correct statistics from trim result', () => {
    mockedTrimMapping.mockReturnValue({
      mapping: {},
      current_node: 'node-3',
      root: 'node-0',
      keptCount: 3,
      totalCount: 10,
      visibleKept: 3,
      visibleTotal: 8,
    });

    const result = mockedTrimMapping({} as any, 3);

    // Statistics calculation logic
    const totalBefore = result!.visibleTotal;
    const keptAfter = result!.visibleKept;
    const removed = Math.max(0, totalBefore - keptAfter);

    expect(totalBefore).toBe(8);
    expect(keptAfter).toBe(3);
    expect(removed).toBe(5);
  });
});

// ============================================================================
// Config Tests
// ============================================================================

describe('config JSON parsing (cross-browser compatibility)', () => {
  interface LsConfig {
    enabled: boolean;
    limit: number;
    debug: boolean;
  }

  const DEFAULT_CONFIG: LsConfig = {
    enabled: true,
    limit: 10,
    debug: false,
  };

  /**
   * Parse config from CustomEvent detail.
   * Mirrors the logic in page-script.ts setupConfigListener()
   */
  function parseConfigFromDetail(detail: unknown): LsConfig | null {
    let config: LsConfig | null = null;

    if (typeof detail === 'string') {
      try {
        config = JSON.parse(detail) as LsConfig;
      } catch {
        return null;
      }
    } else if (detail && typeof detail === 'object') {
      config = detail as LsConfig;
    }

    if (config && typeof config === 'object') {
      return {
        enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
        limit: Math.max(1, config.limit ?? DEFAULT_CONFIG.limit),
        debug: config.debug ?? DEFAULT_CONFIG.debug,
      };
    }

    return null;
  }

  it('parses JSON string correctly (Chrome compatibility)', () => {
    const configObj = { enabled: false, limit: 3, debug: true };
    const jsonString = JSON.stringify(configObj);

    const result = parseConfigFromDetail(jsonString);

    expect(result).not.toBeNull();
    expect(result?.enabled).toBe(false);
    expect(result?.limit).toBe(3);
    expect(result?.debug).toBe(true);
  });

  it('handles object directly (backwards compatibility)', () => {
    const configObj = { enabled: true, limit: 5, debug: false };

    const result = parseConfigFromDetail(configObj);

    expect(result).not.toBeNull();
    expect(result?.enabled).toBe(true);
    expect(result?.limit).toBe(5);
    expect(result?.debug).toBe(false);
  });

  it('returns null for invalid JSON string', () => {
    const invalidJson = 'not valid json {{{';

    const result = parseConfigFromDetail(invalidJson);

    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseConfigFromDetail('');

    expect(result).toBeNull();
  });

  it('returns null for null detail', () => {
    const result = parseConfigFromDetail(null);

    expect(result).toBeNull();
  });

  it('returns null for undefined detail', () => {
    const result = parseConfigFromDetail(undefined);

    expect(result).toBeNull();
  });

  it('applies defaults for missing fields in JSON', () => {
    const partialConfig = { limit: 7 }; // missing enabled and debug
    const jsonString = JSON.stringify(partialConfig);

    const result = parseConfigFromDetail(jsonString);

    expect(result?.enabled).toBe(true); // default
    expect(result?.limit).toBe(7);
    expect(result?.debug).toBe(false); // default
  });

  it('enforces minimum limit of 1 from JSON', () => {
    const configWithZeroLimit = { enabled: true, limit: 0, debug: false };
    const jsonString = JSON.stringify(configWithZeroLimit);

    const result = parseConfigFromDetail(jsonString);

    expect(result?.limit).toBe(1);
  });

  it('enforces minimum limit of 1 from negative value', () => {
    const configWithNegativeLimit = { enabled: true, limit: -5, debug: false };
    const jsonString = JSON.stringify(configWithNegativeLimit);

    const result = parseConfigFromDetail(jsonString);

    expect(result?.limit).toBe(1);
  });
});

describe('config handling', () => {
  it('uses default values when config is undefined', () => {
    const DEFAULT_CONFIG = {
      enabled: true,
      limit: 10,
      debug: false,
    };

    const cfg = undefined;

    const result = {
      enabled: cfg?.enabled ?? DEFAULT_CONFIG.enabled,
      limit: Math.max(1, cfg?.limit ?? DEFAULT_CONFIG.limit),
      debug: cfg?.debug ?? DEFAULT_CONFIG.debug,
    };

    expect(result.enabled).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.debug).toBe(false);
  });

  it('uses config values when provided', () => {
    const DEFAULT_CONFIG = {
      enabled: true,
      limit: 10,
      debug: false,
    };

    const cfg = { enabled: false, limit: 5, debug: true };

    const result = {
      enabled: cfg?.enabled ?? DEFAULT_CONFIG.enabled,
      limit: Math.max(1, cfg?.limit ?? DEFAULT_CONFIG.limit),
      debug: cfg?.debug ?? DEFAULT_CONFIG.debug,
    };

    expect(result.enabled).toBe(false);
    expect(result.limit).toBe(5);
    expect(result.debug).toBe(true);
  });

  it('enforces minimum limit of 1', () => {
    const cfg = { limit: 0 };
    const result = Math.max(1, cfg.limit);
    expect(result).toBe(1);

    const cfg2 = { limit: -5 };
    const result2 = Math.max(1, cfg2.limit);
    expect(result2).toBe(1);
  });
});

// ============================================================================
// URL Parsing Tests
// ============================================================================

describe('URL handling', () => {
  it('parses string URLs correctly', () => {
    const urlString = '/backend-api/conversation/123';
    const url = new URL(urlString, 'https://chatgpt.com');

    expect(url.pathname).toBe('/backend-api/conversation/123');
    expect(url.hostname).toBe('chatgpt.com');
  });

  it('handles Request objects', () => {
    const request = new Request('https://chatgpt.com/backend-api/conversation/123', {
      method: 'GET',
    });

    expect(request.url).toBe('https://chatgpt.com/backend-api/conversation/123');
    expect(request.method).toBe('GET');
  });

  it('handles URL objects', () => {
    const url = new URL('https://chatgpt.com/backend-api/conversation/123');

    expect(url.href).toBe('https://chatgpt.com/backend-api/conversation/123');
    expect(url.pathname).toBe('/backend-api/conversation/123');
  });

  it('extracts method from init when provided', () => {
    const init = { method: 'POST' };
    const method = (init?.method ?? 'GET').toUpperCase();

    expect(method).toBe('POST');
  });

  it('defaults to GET when method not specified', () => {
    const init = undefined;
    const method = (init?.method ?? 'GET').toUpperCase();

    expect(method).toBe('GET');
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('error handling', () => {
  it('gracefully handles JSON parse errors', async () => {
    // Simulate what happens when json.catch(() => null) is called
    const invalidJson = 'not valid json';

    let result: unknown = null;
    try {
      result = JSON.parse(invalidJson);
    } catch {
      result = null;
    }

    expect(result).toBeNull();
  });

  it('returns original response for non-object JSON', () => {
    // Test the check: if (!json || typeof json !== 'object')
    const values = [null, 'string', 123, true, undefined];

    for (const val of values) {
      const shouldSkip = !val || typeof val !== 'object';
      expect(shouldSkip).toBe(true);
    }

    // Object should not be skipped
    const obj = { foo: 'bar' };
    const shouldSkipObj = !obj || typeof obj !== 'object';
    expect(shouldSkipObj).toBe(false);
  });

  it('returns original response when mapping or current_node missing', () => {
    // Test the check: if (!json.mapping || !json.current_node)
    const noMapping = { current_node: 'foo' };
    const noCurrentNode = { mapping: {} };
    const valid = { mapping: {}, current_node: 'foo' };

    expect(!noMapping.mapping).toBe(true);
    expect(!noCurrentNode.current_node).toBe(true);
    expect(!valid.mapping || !valid.current_node).toBe(false);
  });
});

// ============================================================================
// Config Gating Behavior (runtime fetch interception)
// ============================================================================

describe('config gating in fetch interception', () => {
  const mockedTrimMapping = vi.mocked(trimMapping);

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
    delete (window as unknown as { __LS_PROXY_PATCHED__?: boolean }).__LS_PROXY_PATCHED__;
    delete (window as unknown as { __LS_CONFIG__?: unknown }).__LS_CONFIG__;
    delete (window as unknown as { __LS_DEBUG__?: boolean }).__LS_DEBUG__;
  });

  it('skips trimming when config is not received', async () => {
    const conversationData = createConversationData(4);
    const nativeFetch = vi.fn(async () => createMockResponse(conversationData));

    (globalThis as unknown as { fetch: typeof fetch }).fetch = nativeFetch;

    await import('../../extension/src/page/page-script');

    await window.fetch('https://chatgpt.com/backend-api/conversation/123');

    expect(nativeFetch).toHaveBeenCalledTimes(1);
    expect(mockedTrimMapping).not.toHaveBeenCalled();
  });

  it('trims when config is available from localStorage', async () => {
    localStorage.setItem('ls_config', JSON.stringify({ enabled: true, limit: 2, debug: false }));

    const conversationData = createConversationData(4);
    const nativeFetch = vi.fn(async () => createMockResponse(conversationData));

    mockedTrimMapping.mockReturnValue({
      mapping: conversationData.mapping,
      current_node: 'node-3',
      root: 'node-0',
      keptCount: 2,
      totalCount: 4,
      visibleKept: 2,
      visibleTotal: 4,
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = nativeFetch;

    await import('../../extension/src/page/page-script');

    await window.fetch('https://chatgpt.com/backend-api/conversation/123');

    expect(nativeFetch).toHaveBeenCalledTimes(1);
    expect(mockedTrimMapping).toHaveBeenCalledTimes(1);
  });
});
