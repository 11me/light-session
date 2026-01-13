/**
 * LightSession Pro - Message Protocol
 * Runtime communication between background, content, and popup scripts
 */

import browser from './browser-polyfill';
import type { RuntimeMessage, RuntimeResponse, ErrorResponse } from './types';
import { TIMING } from './constants';
import { logError } from './logger';

/**
 * Send runtime message with timeout
 * @param message Message to send
 * @param timeoutMs Timeout in milliseconds (default: 500ms)
 * @returns Promise resolving to response or rejecting on timeout/error
 */
export async function sendMessageWithTimeout<T extends RuntimeResponse>(
  message: RuntimeMessage,
  timeoutMs: number = TIMING.MESSAGE_TIMEOUT_MS
): Promise<T> {
  // Detect Chrome vs Firefox using feature detection
  // Firefox has browser.runtime.getBrowserInfo() which Chrome doesn't have
  // This is more reliable than checking global objects which can be polyfilled
  const isFirefox = typeof browser.runtime.getBrowserInfo === 'function';
  const isChrome = !isFirefox && typeof chrome !== 'undefined' && !!chrome.runtime;
  const retryDelays = TIMING.MESSAGE_RETRY_DELAYS_MS;
  let lastError: Error | undefined;

  // Attempt with retries for Chrome service worker wake-up
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      const response = await Promise.race([
        browser.runtime.sendMessage(message) as Promise<T | undefined>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
        ),
      ]);

      // Check Chrome lastError (set when no listener exists)
      if (isChrome && chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message ?? 'Chrome runtime error');
      }

      // Validate response is not undefined (Chrome returns undefined if service worker inactive)
      if (response === undefined) {
        if (attempt < retryDelays.length) {
          // Wait before retry with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
          continue;
        }
        throw new Error('Service worker not responding - received undefined after retries');
      }

      // Check for error response from handler (don't retry real errors)
      if ('error' in response && typeof response.error === 'string') {
        throw new Error(`Handler error: ${response.error}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on timeout or handler errors - these are real failures
      if (lastError.message === 'Message timeout' || lastError.message.startsWith('Handler error:')) {
        throw lastError;
      }

      // Retry if we haven't exhausted attempts
      if (attempt < retryDelays.length) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
        continue;
      }

      throw lastError;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError ?? new Error('Message failed after retries');
}

/**
 * Message listener type that works with both Firefox and Chrome.
 *
 * In Firefox: returning a Promise from the listener works natively.
 * In Chrome MV3: we need to use sendResponse callback and return true
 * for async responses.
 *
 * This type represents the raw listener signature expected by both browsers.
 */
export type MessageListener = (
  message: RuntimeMessage,
  sender: browser.runtime.MessageSender,
  sendResponse: (response: RuntimeResponse) => void
) => boolean | void;

/**
 * Create a message handler function for use with browser.runtime.onMessage
 *
 * This wrapper handles the difference between Firefox and Chrome:
 * - Firefox: supports returning Promise from listener
 * - Chrome: requires sendResponse callback + returning true for async
 *
 * For maximum compatibility, we use the sendResponse pattern which works in both.
 */
export function createMessageHandler(
  handler: (
    message: RuntimeMessage,
    sender: browser.runtime.MessageSender
  ) => RuntimeResponse | Promise<RuntimeResponse>
): MessageListener {
  return (
    message: RuntimeMessage,
    sender: browser.runtime.MessageSender,
    sendResponse: (response: RuntimeResponse) => void
  ): boolean => {
    // Handle the message asynchronously
    void (async () => {
      try {
        const response = await handler(message, sender);
        sendResponse(response);
      } catch (error) {
        logError('Message handler error:', error);
        // Send error response so caller doesn't hang waiting for response
        // Caller must check for error field in response
        const errorResponse: ErrorResponse = { error: String(error) };
        sendResponse(errorResponse);
      }
    })();

    // Return true to indicate we will send a response asynchronously
    // This is required for Chrome to keep the message channel open
    return true;
  };
}
