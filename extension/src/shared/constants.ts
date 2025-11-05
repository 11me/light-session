/**
 * LightSession for ChatGPT - Constants
 * All magic numbers, timing values, and selector definitions
 */

import type { LsSettings, SelectorTier } from './types';

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_SETTINGS: Readonly<LsSettings> = {
  version: 1,
  enabled: true,
  keep: 10,
  preserveSystem: true,
  pauseOnScrollUp: true,
  debug: false,
} as const;

// ============================================================================
// Timing Constants
// ============================================================================

export const TIMING = {
  /**
   * Debounce delay for MutationObserver (ms)
   * Batch rapid DOM changes into single trim evaluation
   */
  DEBOUNCE_MS: 75,

  /**
   * Main thread budget per batch (ms)
   * Must be ≤16ms for 60fps
   */
  BATCH_BUDGET_MS: 16,

  /**
   * Nodes to remove per batch
   * Tuned for ~10-15ms execution time
   */
  NODES_PER_BATCH: 7,

  /**
   * Scroll event throttle (ms)
   * Check isAtBottom at most once per 100ms
   */
  SCROLL_THROTTLE_MS: 100,

  /**
   * Message timeout for runtime.sendMessage (ms)
   */
  MESSAGE_TIMEOUT_MS: 500,
} as const;

// ============================================================================
// DOM Constants
// ============================================================================

export const DOM = {
  /**
   * Minimum valid message nodes to proceed with trim
   * Fail-safe: < 6 messages = abort
   */
  MIN_CANDIDATES: 2,

  /**
   * Threshold for isAtBottom detection (px)
   * scrollTop + clientHeight + threshold >= scrollHeight
   */
  BOTTOM_THRESHOLD_PX: 100,

  /**
   * Y-coordinate monotonicity tolerance (px)
   * Allow small violations due to layout shifts
   */
  Y_TOLERANCE_PX: 4,

  /**
   * Comment marker for removed nodes
   */
  REMOVAL_MARKER: 'ls-removed',
} as const;

// ============================================================================
// Selector Tier Definitions
// ============================================================================

/**
 * Multi-tier selector strategy for DOM resilience
 * Try Tier A first, fallback to B, then C if necessary
 */
export const SELECTOR_TIERS: Readonly<SelectorTier[]> = [
  {
    name: 'A',
    description: 'Conversation turn containers',
    selectors: [
      '[data-message-id]',
      'article[data-message-id]',
      '[data-message-author]',
      '[data-message-author-role]',
      '[data-turn]',
      '[data-testid=conversation-turn]',
      '[data-testid^=conversation-turn-]',
      '[data-testid=assistant-turn]',
      '[data-testid=user-turn]'
    ],
    minCandidates: DOM.MIN_CANDIDATES,
  },
  {
    name: 'B',
    description: 'Semantic fallbacks (roles + test IDs)',
    selectors: [
      '[data-testid="conversation-turn"]',
      '[data-testid^="conversation-turn-"]',
      '[data-testid="assistant-turn"]',
      '[data-testid="user-turn"]',
      '[data-testid*="message" i]',
      '[data-turn]',
      'article[role="article"]',
      'div[role="article"]',
      'section[aria-label*="chat history" i] article',
      'ol[role="list"] > li[role="listitem"] article',
      'div[class*="conversation-turn" i]',
    ],
    minCandidates: DOM.MIN_CANDIDATES,
  },
  {
    name: 'C',
    description: 'Defensive (structural + heuristics)',
    selectors: [
      'main article',
      'main > div > div',
      '[role="main"] article',
      '[role="main"] > div > div',
    ], // Must be filtered by isLikelyMessage()
    minCandidates: DOM.MIN_CANDIDATES,
  },
] as const;

// ============================================================================
// Logging Constants
// ============================================================================

export const LOG_PREFIX = 'LS:' as const;

// ============================================================================
// Validation Ranges
// ============================================================================

export const VALIDATION = {
  /**
   * Minimum keep value (inclusive)
   */
  MIN_KEEP: 1,

  /**
   * Maximum keep value (inclusive)
   */
  MAX_KEEP: 100,
} as const;
