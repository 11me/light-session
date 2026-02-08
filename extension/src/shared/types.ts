/**
 * LightSession for ChatGPT - Shared Type Definitions
 * All core interfaces and type definitions used across the extension
 */

// ============================================================================
// Settings Schema (Persistent State)
// ============================================================================

export interface LsSettings {
  version: 1; // Schema version for future migrations
  enabled: boolean; // Toggle trimming on/off
  keep: number; // Message retention limit (1-100)
  showStatusBar: boolean; // Show in-page status bar with trimming stats
  collapseLongUserMessages: boolean; // Collapse long user messages in UI (presentation-only)
  debug: boolean; // Enable debug logging
  ultraLean: boolean; // Enable aggressive performance optimizations (adds .ls-ultra-lean class)
}

// ============================================================================
// Trim Status (Page Script → Content Script)
// ============================================================================

/**
 * Status payload from page script after trimming conversation data.
 * Dispatched via CustomEvent to content script for status bar display.
 */
export interface TrimStatus {
  totalBefore: number; // Total visible messages before trim
  keptAfter: number; // Visible messages kept after trim
  removed: number; // Messages removed (totalBefore - keptAfter)
  limit: number; // Current keep limit setting
}

// ============================================================================
// Message Protocol Types (Runtime Communication)
// ============================================================================

/**
 * Request settings from background script
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
 * Update settings in background script
 */
export interface SetSettingsMessage {
  type: 'SET_SETTINGS';
  payload: Partial<Omit<LsSettings, 'version'>>;
}

/**
 * Confirmation of settings update
 */
export interface SetSettingsResponse {
  ok: true;
}

/**
 * Health check message
 */
export interface PingMessage {
  type: 'PING';
}

/**
 * Health check response
 */
export interface PongMessage {
  type: 'PONG';
  timestamp: number;
}

/**
 * Error response from message handler
 */
export interface ErrorResponse {
  error: string;
}

/**
 * Union of all runtime messages
 */
export type RuntimeMessage = GetSettingsMessage | SetSettingsMessage | PingMessage;

/**
 * Union of all runtime responses
 */
export type RuntimeResponse = GetSettingsResponse | SetSettingsResponse | PongMessage | ErrorResponse;
