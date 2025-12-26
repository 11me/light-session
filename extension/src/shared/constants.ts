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
  showStatusBar: true,
  debug: false,
} as const;

// ============================================================================
// Timing Constants
// ============================================================================

export const TIMING = {
  /**
   * Debounce delay for MutationObserver callback invocations (ms).
   *
   * Rationale:
   * - 75ms provides good balance between responsiveness and efficiency
   * - At 60fps, one frame = ~16.67ms, so 75ms = ~4.5 frames
   * - Typical user typing/scrolling generates 10-50 mutations per second
   * - 75ms batches these into ~13 evaluations/second max
   * - Short enough to feel responsive, long enough to batch rapid changes
   */
  DEBOUNCE_MS: 75,

  /**
   * Main thread budget per requestIdleCallback batch (ms).
   *
   * Rationale:
   * - 16ms = one frame at 60fps, the target for smooth animations
   * - We use requestIdleCallback which yields to more urgent work
   * - Actual execution may be shorter if browser needs the time
   * - Ensures trimming doesn't cause visible jank or dropped frames
   */
  BATCH_BUDGET_MS: 16,

  /**
   * Number of DOM nodes to remove per batch iteration.
   *
   * Rationale:
   * - Empirically tuned: ~2ms average per node removal (DOM mutation + repaint)
   * - 7 nodes * 2ms = ~14ms < 16ms budget with small margin
   * - Tested on M1 Mac and older Windows laptops
   * - Lower values increase latency; higher values risk frame drops
   */
  NODES_PER_BATCH: 7,

  /**
   * Throttle interval for scroll event handler (ms).
   *
   * Rationale:
   * - 100ms = 10 checks/second max, sufficient for bottom detection
   * - Scroll events can fire 60+ times/second during smooth scroll
   * - Reduces CPU overhead without perceptible lag
   */
  SCROLL_THROTTLE_MS: 100,

  /**
   * Timeout for runtime.sendMessage responses (ms).
   *
   * Rationale:
   * - Background script should respond nearly instantly (~5-20ms)
   * - 500ms provides generous margin for slow devices/busy main thread
   * - Prevents UI from hanging if background script is unresponsive
   */
  MESSAGE_TIMEOUT_MS: 500,
} as const;

// ============================================================================
// DOM Constants
// ============================================================================

export const DOM = {
  /**
   * Minimum valid message nodes required to proceed with trim evaluation.
   *
   * Rationale:
   * - At least 2 messages needed for a meaningful conversation
   * - Prevents accidental page destruction on selector failures
   * - Acts as fail-safe when ChatGPT DOM structure changes
   * - If fewer candidates found, all selector tiers have failed
   */
  MIN_CANDIDATES: 2,

  /**
   * Pixel threshold for "at bottom" scroll detection.
   *
   * Rationale:
   * - 100px accounts for floating UI elements at page bottom
   * - Formula: scrollTop + clientHeight + threshold >= scrollHeight
   * - Prevents false negatives when user is "almost" at bottom
   * - Not too large to trigger when genuinely scrolled up
   */
  BOTTOM_THRESHOLD_PX: 100,

  /**
   * Tolerance for Y-coordinate monotonicity validation (px).
   *
   * Rationale:
   * - Messages should appear in visual order (increasing Y)
   * - 4px tolerance handles subpixel rendering and layout shifts
   * - Prevents false positives from floating-point rounding
   * - If sequence is non-monotonic beyond tolerance, selector failed
   */
  Y_TOLERANCE_PX: 4,

  /**
   * Comment marker prefix for removed DOM nodes.
   * Format: "ls-removed-{messageId}-{role}"
   *
   * Rationale:
   * - Preserves DOM structure for debugging
   * - Allows identification of which messages were trimmed
   * - Won't affect ChatGPT's functionality
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

// ============================================================================
// External URLs
// ============================================================================

export const SUPPORT_URL = 'https://github.com/11me/light-session#support' as const;
