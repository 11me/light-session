/**
 * Isolated test for bootstrap-sync deduplication.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../extension/src/shared/trimmer', () => ({
  trimMapping: vi.fn(),
}));

import { trimMapping } from '../../extension/src/shared/trimmer';
import { clearProxyReady } from '../../extension/src/shared/proxy-ready';

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

  Object.defineProperty(response, 'url', { value: url });

  return response;
}

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

describe('bootstrap authoritative sync deduplication', () => {
  const mockedTrimMapping = vi.mocked(trimMapping);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
    clearProxyReady();
    delete (window as unknown as { __LS_PROXY_PATCHED__?: boolean }).__LS_PROXY_PATCHED__;
    delete (window as unknown as { __LS_CONFIG__?: unknown }).__LS_CONFIG__;
    delete (window as unknown as { __LS_DEBUG__?: boolean }).__LS_DEBUG__;
    delete (window as unknown as { __LS_BOOTSTRAP_SYNC_LISTENER__?: boolean }).__LS_BOOTSTRAP_SYNC_LISTENER__;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deduplicates bootstrap sync once authoritative conversation data is already known', async () => {
    localStorage.setItem('ls_config', JSON.stringify({ enabled: true, limit: 2, debug: false }));

    const conversationData = createConversationData(4);
    const successResponse = createMockResponse(conversationData, {
      url: 'https://chatgpt.com/backend-api/conversation/bootstrap-456',
    });
    const nativeFetch = vi.fn<typeof fetch>().mockResolvedValue(successResponse);

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
    await window.fetch('https://chatgpt.com/backend-api/conversation/bootstrap-456');
    const callCountAfterAuthoritativeFetch = nativeFetch.mock.calls.length;

    window.dispatchEvent(
      new CustomEvent('lightsession-bootstrap-sync', {
        detail: JSON.stringify({ conversationId: 'bootstrap-456' }),
      })
    );

    await vi.runAllTimersAsync();
    expect(nativeFetch.mock.calls.length).toBe(callCountAfterAuthoritativeFetch);
  });
});
