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
  preserveSystem: boolean; // Preserve system/tool messages beyond limit
  pauseOnScrollUp: boolean; // Pause trimming when user scrolls up
  debug: boolean; // Enable debug logging
}

// ============================================================================
// Runtime Types (Transient State)
// ============================================================================

/**
 * Message role classification for trimming decisions
 */
export type MsgRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown';

/**
 * Metadata for a candidate conversation message node
 */
export interface NodeInfo {
  node: HTMLElement; // Reference to DOM element
  role: MsgRole; // Classified message role
  id: string; // Stable identifier (data-message-id or generated)
  y: number; // Vertical scroll position (getBoundingClientRect().top)
  visible: boolean; // Visibility heuristic result
}

/**
 * Trimmer state machine states
 */
export type TrimmerStateType = 'IDLE' | 'OBSERVING' | 'PENDING_TRIM' | 'TRIMMING';

/**
 * Complete trimmer state
 */
export interface TrimmerState {
  current: TrimmerStateType;
  observer: MutationObserver | null;
  trimScheduled: boolean; // Debounce flag
  lastTrimTime: number; // performance.now() of last trim
  conversationRoot: HTMLElement | null;
  scrollContainer: HTMLElement | null;
  isAtBottom: boolean; // Scroll position tracking
  settings: LsSettings; // Cached settings (refreshed on storage change)
}

// ============================================================================
// DOM Selector Strategy Types
// ============================================================================

/**
 * Multi-tier selector strategy for DOM resilience
 */
export interface SelectorTier {
  name: 'A' | 'B' | 'C';
  description: string;
  selectors: string[];
  minCandidates: number; // Minimum valid results to accept this tier
}

export type SelectorTierName = 'A' | 'B' | 'C';

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
 * Union of all runtime messages
 */
export type RuntimeMessage = GetSettingsMessage | SetSettingsMessage | PingMessage;

/**
 * Union of all runtime responses
 */
export type RuntimeResponse = GetSettingsResponse | SetSettingsResponse | PongMessage;
