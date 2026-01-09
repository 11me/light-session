/**
 * LightSession Pro - Message Protocol
 * Runtime communication between background, content, and popup scripts
 */

import browser from './browser-polyfill';
import type { RuntimeMessage, RuntimeResponse } from './types';
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
  return Promise.race([
    browser.runtime.sendMessage(message) as Promise<T>,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
    ),
  ]);
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
        // Send error response so caller doesn't hang
        sendResponse({ error: String(error) } as unknown as RuntimeResponse);
      }
    })();

    // Return true to indicate we will send a response asynchronously
    // This is required for Chrome to keep the message channel open
    return true;
  };
}
