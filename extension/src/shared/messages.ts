/**
 * LightSession for ChatGPT - Message Protocol
 * Runtime communication between background, content, and popup scripts
 */

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
 * Create a message handler function for use with browser.runtime.onMessage
 * Wraps handler in try-catch and ensures proper return types
 */
export function createMessageHandler(
  handler: (
    message: RuntimeMessage,
    sender: browser.runtime.MessageSender
  ) => RuntimeResponse | Promise<RuntimeResponse>
): (
  message: RuntimeMessage,
  sender: browser.runtime.MessageSender
) => Promise<RuntimeResponse> | RuntimeResponse {
  return (message: RuntimeMessage, sender: browser.runtime.MessageSender) => {
    try {
      return handler(message, sender);
    } catch (error) {
      logError('Message handler error:', error);
      throw error;
    }
  };
}
