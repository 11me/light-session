/**
 * Unit tests for messages.ts - Runtime message protocol
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions for browser runtime
const mockSendMessage = vi.fn();

// Mock browser-polyfill BEFORE importing messages
vi.mock('../../extension/src/shared/browser-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    },
  },
}));

// Mock logger
vi.mock('../../extension/src/shared/logger', () => ({
  logError: vi.fn(),
}));

// Import functions AFTER mocks are set up
import { sendMessageWithTimeout, createMessageHandler } from '../../extension/src/shared/messages';
import type { RuntimeMessage, RuntimeResponse } from '../../extension/src/shared/types';

describe('sendMessageWithTimeout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  it('returns response when message succeeds within timeout', async () => {
    const expectedResponse = { settings: { enabled: true, keep: 10 } };
    mockSendMessage.mockResolvedValue(expectedResponse);

    const responsePromise = sendMessageWithTimeout({ type: 'GET_SETTINGS' });

    // Fast-forward time but response should come before timeout
    await vi.runAllTimersAsync();

    const response = await responsePromise;
    expect(response).toEqual(expectedResponse);
    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_SETTINGS' });
  });

  it('rejects with timeout error when message takes too long', async () => {
    // Never resolve the promise
    mockSendMessage.mockImplementation(() => new Promise(() => {}));

    const responsePromise = sendMessageWithTimeout({ type: 'GET_SETTINGS' }, 100);

    // Fast-forward past timeout
    vi.advanceTimersByTime(150);

    await expect(responsePromise).rejects.toThrow('Message timeout');
  });

  it('rejects when sendMessage fails', async () => {
    vi.useRealTimers(); // Use real timers for this test
    mockSendMessage.mockRejectedValue(new Error('Connection failed'));

    await expect(
      sendMessageWithTimeout({ type: 'GET_SETTINGS' })
    ).rejects.toThrow('Connection failed');
  });

  it('uses default timeout from TIMING constant', async () => {
    mockSendMessage.mockImplementation(() => new Promise(() => {}));

    const responsePromise = sendMessageWithTimeout({ type: 'GET_SETTINGS' });

    // Default timeout is MESSAGE_TIMEOUT_MS (500ms from constants)
    vi.advanceTimersByTime(499);

    // Should not have timed out yet
    expect(responsePromise).toBeInstanceOf(Promise);

    vi.advanceTimersByTime(10);

    await expect(responsePromise).rejects.toThrow('Message timeout');
  });
});

describe('sendMessageWithTimeout retry logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('retries on undefined response and succeeds after retry', async () => {
    const expectedResponse = { settings: { enabled: true, keep: 10 } };
    // First call returns undefined, second succeeds
    mockSendMessage
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(expectedResponse);

    const response = await sendMessageWithTimeout({ type: 'GET_SETTINGS' });

    expect(response).toEqual(expectedResponse);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('retries multiple times on undefined responses', async () => {
    const expectedResponse = { settings: { enabled: true, keep: 10 } };
    // First two calls return undefined, third succeeds
    mockSendMessage
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(expectedResponse);

    const response = await sendMessageWithTimeout({ type: 'GET_SETTINGS' });

    expect(response).toEqual(expectedResponse);
    expect(mockSendMessage).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries exceeded on persistent undefined', async () => {
    // All calls return undefined
    mockSendMessage.mockResolvedValue(undefined);

    await expect(
      sendMessageWithTimeout({ type: 'GET_SETTINGS' })
    ).rejects.toThrow('Service worker not responding - received undefined after retries');

    // Initial attempt + 3 retries = 4 calls
    expect(mockSendMessage).toHaveBeenCalledTimes(4);
  });

  it('does not retry on timeout error', async () => {
    vi.useFakeTimers();
    // Never resolve - will timeout
    mockSendMessage.mockImplementation(() => new Promise(() => {}));

    const responsePromise = sendMessageWithTimeout({ type: 'GET_SETTINGS' }, 100);

    // Fast-forward past timeout
    vi.advanceTimersByTime(150);

    await expect(responsePromise).rejects.toThrow('Message timeout');
    // Should only try once - timeout doesn't trigger retry
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it('retries on error and succeeds after retry', async () => {
    const expectedResponse = { settings: { enabled: true, keep: 10 } };
    // First call throws error, second succeeds
    mockSendMessage
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce(expectedResponse);

    const response = await sendMessageWithTimeout({ type: 'GET_SETTINGS' });

    expect(response).toEqual(expectedResponse);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('createMessageHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('returns true to keep channel open for async response', () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const messageHandler = createMessageHandler(handler);
    const sendResponse = vi.fn();

    const result = messageHandler(
      { type: 'SET_SETTINGS', payload: {} } as RuntimeMessage,
      {} as browser.runtime.MessageSender,
      sendResponse
    );

    // Must return true for Chrome async response
    expect(result).toBe(true);
  });

  it('calls handler with message and sender', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const messageHandler = createMessageHandler(handler);
    const sendResponse = vi.fn();
    const message = { type: 'SET_SETTINGS', payload: { enabled: false } } as RuntimeMessage;
    const sender = { id: 'test-extension' } as browser.runtime.MessageSender;

    messageHandler(message, sender, sendResponse);

    // Wait for async handler to complete
    await vi.waitFor(() => expect(handler).toHaveBeenCalled());

    expect(handler).toHaveBeenCalledWith(message, sender);
  });

  it('calls sendResponse with handler result', async () => {
    const expectedResponse = { settings: { enabled: true, keep: 10 } } as RuntimeResponse;
    const handler = vi.fn().mockResolvedValue(expectedResponse);
    const messageHandler = createMessageHandler(handler);
    const sendResponse = vi.fn();

    messageHandler(
      { type: 'GET_SETTINGS' } as RuntimeMessage,
      {} as browser.runtime.MessageSender,
      sendResponse
    );

    // Wait for async handler to complete
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse).toHaveBeenCalledWith(expectedResponse);
  });

  it('calls sendResponse with error when handler throws', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));
    const messageHandler = createMessageHandler(handler);
    const sendResponse = vi.fn();

    messageHandler(
      { type: 'GET_SETTINGS' } as RuntimeMessage,
      {} as browser.runtime.MessageSender,
      sendResponse
    );

    // Wait for async handler to complete
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Handler failed') })
    );
  });

  it('handles synchronous errors in handler', async () => {
    const handler = vi.fn().mockImplementation(() => {
      throw new Error('Sync error');
    });
    const messageHandler = createMessageHandler(handler);
    const sendResponse = vi.fn();

    messageHandler(
      { type: 'GET_SETTINGS' } as RuntimeMessage,
      {} as browser.runtime.MessageSender,
      sendResponse
    );

    // Wait for async handler to complete
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Sync error') })
    );
  });

  it('works with sync handler that returns value directly', async () => {
    const expectedResponse = { type: 'PONG', timestamp: 123 } as RuntimeResponse;
    // Handler returns value directly (not a Promise)
    const handler = vi.fn().mockReturnValue(expectedResponse);
    const messageHandler = createMessageHandler(handler);
    const sendResponse = vi.fn();

    messageHandler(
      { type: 'PING' } as RuntimeMessage,
      {} as browser.runtime.MessageSender,
      sendResponse
    );

    // Wait for response
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse).toHaveBeenCalledWith(expectedResponse);
  });
});
