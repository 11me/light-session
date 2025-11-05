/**
 * Message Protocol Contract: LightSession for ChatGPT
 *
 * Defines runtime.sendMessage communication between popup, background, and content scripts
 * Source: constitution § 4.2, data-model.md § 3.1
 */

import type { LsSettings } from './storage-schema.js';

/**
 * Request to retrieve current settings from background script
 *
 * @remarks
 * - Sent by: popup → background, content → background
 * - Response: GetSettingsResponse
 * - Timeout: 500ms
 */
export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

/**
 * Response containing current settings
 */
export interface GetSettingsResponse {
  settings: LsSettings;
}

/**
 * Request to update settings (partial merge)
 *
 * @remarks
 * - Sent by: popup → background
 * - Response: SetSettingsResponse
 * - Side effect: browser.storage.local.set() + storage.onChanged event
 */
export interface SetSettingsMessage {
  type: 'SET_SETTINGS';
  payload: Partial<Omit<LsSettings, 'version'>>;
}

/**
 * Response confirming settings update
 */
export interface SetSettingsResponse {
  ok: true;
}

/**
 * Health check ping (popup ↔ content script)
 *
 * @remarks
 * - Used to verify content script injection and responsiveness
 * - Response: PongMessage
 */
export interface PingMessage {
  type: 'PING';
}

/**
 * Health check response with timestamp
 */
export interface PongMessage {
  type: 'PONG';
  timestamp: number; // Date.now()
}

/**
 * Union of all request message types
 */
export type RuntimeMessage = GetSettingsMessage | SetSettingsMessage | PingMessage;

/**
 * Union of all response message types
 */
export type RuntimeResponse = GetSettingsResponse | SetSettingsResponse | PongMessage;

/**
 * Send message with timeout fallback
 *
 * @param message - Message to send
 * @param timeoutMs - Timeout in milliseconds (default: 500ms per constitution § 4.2)
 * @returns Promise resolving to response or rejecting on timeout
 *
 * @throws {Error} If message times out or recipient not available
 *
 * @example
 * const response = await sendMessageWithTimeout<GetSettingsResponse>({
 *   type: 'GET_SETTINGS'
 * });
 */
export async function sendMessageWithTimeout<T extends RuntimeResponse>(
  message: RuntimeMessage,
  timeoutMs = 500
): Promise<T> {
  return Promise.race([
    browser.runtime.sendMessage(message) as Promise<T>,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Message timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Type-safe message handler for background script
 *
 * @param handler - Handler function mapping message types to responses
 * @returns runtime.onMessage listener function
 *
 * @example
 * browser.runtime.onMessage.addListener(createMessageHandler({
 *   GET_SETTINGS: async () => ({ settings: await loadSettings() }),
 *   SET_SETTINGS: async (msg) => {
 *     await updateSettings(msg.payload);
 *     return { ok: true };
 *   }
 * }));
 */
export function createMessageHandler(handlers: {
  GET_SETTINGS: () => Promise<GetSettingsResponse> | GetSettingsResponse;
  SET_SETTINGS: (msg: SetSettingsMessage) => Promise<SetSettingsResponse> | SetSettingsResponse;
  PING?: () => PongMessage;
}): (message: RuntimeMessage, sender: browser.runtime.MessageSender) => Promise<RuntimeResponse> | RuntimeResponse {
  return (message: RuntimeMessage, sender) => {
    try {
      switch (message.type) {
        case 'GET_SETTINGS':
          return handlers.GET_SETTINGS();

        case 'SET_SETTINGS':
          return handlers.SET_SETTINGS(message);

        case 'PING':
          return handlers.PING?.() ?? { type: 'PONG', timestamp: Date.now() };

        default:
          throw new Error(`Unknown message type: ${(message as any).type}`);
      }
    } catch (error) {
      console.error('LS: Message handler error:', error);
      throw error;
    }
  };
}
