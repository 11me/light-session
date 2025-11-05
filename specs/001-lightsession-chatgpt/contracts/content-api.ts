/**
 * Content Script Internal API Contract: LightSession for ChatGPT
 *
 * Defines internal APIs for content script modules (dom-helpers, trimmer, observers)
 * Source: constitution § 4.3, data-model.md § 2
 */

/**
 * Message role classification
 *
 * @remarks
 * - Used to determine preservation eligibility
 * - Detection heuristics in dom-helpers.ts
 */
export type MsgRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown';

/**
 * Metadata for a conversation message node
 *
 * @remarks
 * - Ephemeral lifecycle: created per trim evaluation, discarded after
 * - Memory: ~150 bytes per instance
 * - Typical count: 10-500 per evaluation
 */
export interface NodeInfo {
  /** Reference to DOM element */
  node: HTMLElement;

  /** Classified message role */
  role: MsgRole;

  /** Stable identifier (from data-message-id or generated hash) */
  id: string;

  /** Vertical scroll position (getBoundingClientRect().top) */
  y: number;

  /** Visibility heuristic result */
  visible: boolean;
}

/**
 * Trimmer state machine states
 *
 * @remarks
 * Transition flow (from constitution § 6):
 * IDLE → OBSERVING → PENDING_TRIM → TRIMMING → OBSERVING
 */
export type TrimmerStateType = 'IDLE' | 'OBSERVING' | 'PENDING_TRIM' | 'TRIMMING';

/**
 * Runtime state for trimmer state machine
 *
 * @remarks
 * - Single instance per content script
 * - Memory: ~500 bytes
 */
export interface TrimmerState {
  /** Current state machine state */
  current: TrimmerStateType;

  /** MutationObserver instance (null in IDLE) */
  observer: MutationObserver | null;

  /** Debounce flag for scheduleTrim */
  trimScheduled: boolean;

  /** Timestamp of last completed trim (performance.now()) */
  lastTrimTime: number;

  /** Conversation container root element */
  conversationRoot: HTMLElement | null;

  /** Scrollable ancestor container */
  scrollContainer: HTMLElement | null;

  /** User at bottom of conversation flag */
  isAtBottom: boolean;

  /** Cached settings (refreshed on storage.onChanged) */
  settings: import('./storage-schema.js').LsSettings;
}

/**
 * Selector tier metadata
 *
 * @remarks
 * - Three tiers: A (current UI), B (fallback), C (defensive)
 * - From tz.md § 6.5.4
 */
export interface SelectorTier {
  /** Tier identifier */
  name: 'A' | 'B' | 'C';

  /** Human-readable description */
  description: string;

  /** CSS selector strings */
  selectors: readonly string[];

  /** Minimum valid candidates for tier success */
  minCandidates: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM Helpers API (dom-helpers.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find conversation container root element
 *
 * @returns Root element or null if not found
 *
 * @remarks
 * - Identifies scrollable container holding conversation messages
 * - Uses LCA (lowest common ancestor) of message nodes
 */
export function findConversationRoot(): HTMLElement | null;

/**
 * Find scrollable ancestor of an element
 *
 * @param el - Element to search from
 * @returns Scrollable ancestor or document.scrollingElement
 *
 * @remarks
 * - Checks overflow-y: scroll/auto and scrollHeight > clientHeight
 */
export function findScrollableAncestor(el: HTMLElement): HTMLElement | null;

/**
 * Collect candidate message nodes using multi-tier selector strategy
 *
 * @returns Object containing nodes array and successful tier identifier
 *
 * @remarks
 * - Tries tiers A → B → C until ≥6 valid candidates found
 * - Returns empty array if all tiers fail (fail-safe)
 * - From tz.md § 6.5.3, § 6.5.4
 */
export function collectCandidates(): { nodes: HTMLElement[]; tier: 'A' | 'B' | 'C' | null };

/**
 * Check if element matches visibility heuristics
 *
 * @param el - Element to check
 * @returns true if element is visible
 *
 * @remarks
 * - From tz.md § 6.5.6
 * - Checks: offsetParent !== null, getClientRects().length > 0, no hidden ancestors
 */
export function isVisible(el: HTMLElement): boolean;

/**
 * Detect message role from element attributes and structure
 *
 * @param el - Message element
 * @returns Classified role
 *
 * @remarks
 * - From tz.md § 6.5.5
 * - Priority: data attributes > structural > ARIA roles > 'unknown'
 */
export function detectRole(el: HTMLElement): MsgRole;

/**
 * Build active thread array with metadata
 *
 * @param root - Conversation root element
 * @returns Array of NodeInfo for visible messages in active branch
 *
 * @remarks
 * - Filters to visible nodes only
 * - Validates Y-coordinate monotonicity (±4px tolerance)
 * - Returns empty array if validation fails
 */
export function buildActiveThread(root: HTMLElement | null): NodeInfo[];

/**
 * Check if Y-coordinates are monotonically increasing
 *
 * @param nodes - NodeInfo array to validate
 * @returns true if sequence valid
 *
 * @remarks
 * - Allows ±4px tolerance for flex/grid layouts
 * - From tz.md § 6.5.6
 */
export function isSequenceValid(nodes: NodeInfo[]): boolean;

// ─────────────────────────────────────────────────────────────────────────────
// Trimmer API (trimmer.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize trimmer and transition to OBSERVING state
 *
 * @param state - Current trimmer state
 * @returns Updated state
 *
 * @remarks
 * - Finds conversation root, attaches MutationObserver
 * - Stays in IDLE if root not found (fail-safe)
 */
export function boot(state: TrimmerState): TrimmerState;

/**
 * Schedule trim evaluation with debouncing
 *
 * @param state - Current trimmer state
 * @returns Updated state with trimScheduled flag set
 *
 * @remarks
 * - Debounces with 75ms delay (constitution § 7)
 * - No-op if already scheduled or disabled
 */
export function scheduleTrim(state: TrimmerState): TrimmerState;

/**
 * Evaluate preconditions and perform trim if eligible
 *
 * @param state - Current trimmer state
 * @returns Updated state after trim or precondition failure
 *
 * @remarks
 * Preconditions (from constitution § 6):
 * - enabled = true
 * - isAtBottom = true (if pauseOnScrollUp enabled)
 * - !isStreaming
 * - ≥6 valid candidates
 * - overflow > 0
 */
export function evaluateTrim(state: TrimmerState): TrimmerState;

/**
 * Calculate keep count with system/tool preservation
 *
 * @param nodes - All message nodes
 * @param settings - User settings
 * @returns Effective keep count (settings.keep + preserved count)
 */
export function calculateKeepCount(nodes: NodeInfo[], settings: import('./storage-schema.js').LsSettings): number;

/**
 * Execute batched node removal via requestIdleCallback
 *
 * @param nodes - Nodes to remove
 * @param observer - MutationObserver to temporarily disconnect
 *
 * @remarks
 * - Chunks into 5-10 node batches
 * - 16ms budget per batch
 * - Replaces nodes with Comment('ls-removed')
 * - From research.md § 6
 */
export function executeTrim(nodes: NodeInfo[], observer: MutationObserver | null): void;

/**
 * Check if ChatGPT is currently generating a response
 *
 * @param root - Conversation root element
 * @returns true if streaming indicator detected
 *
 * @remarks
 * - Looks for typing indicators, "Stop generating" button, progress bars
 * - From tz.md § 6.5.8
 */
export function isStreaming(root: HTMLElement | null): boolean;

/**
 * Cleanup observers and reset to IDLE state
 *
 * @param state - Current trimmer state
 * @returns Reset state
 */
export function shutdown(state: TrimmerState): TrimmerState;

// ─────────────────────────────────────────────────────────────────────────────
// Observer API (observers.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create debounced mutation observer
 *
 * @param callback - Callback to invoke after debounce period
 * @param debounceMs - Debounce delay (default: 75ms)
 * @returns MutationObserver instance
 *
 * @remarks
 * - Batches rapid mutations during streaming
 * - From research.md § 2
 */
export function createDebouncedObserver(
  callback: () => void,
  debounceMs?: number
): MutationObserver;

/**
 * Setup scroll position tracking
 *
 * @param container - Scrollable container
 * @param onScrollChange - Callback when isAtBottom changes
 * @returns Cleanup function
 *
 * @remarks
 * - Throttled to 100ms
 * - 100px threshold for "at bottom"
 * - From research.md § 7
 */
export function setupScrollTracking(
  container: HTMLElement,
  onScrollChange: (isAtBottom: boolean) => void
): () => void;

// ─────────────────────────────────────────────────────────────────────────────
// Logger API (shared/logger.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conditional debug logger
 *
 * @param message - Log message
 * @param data - Optional data to log
 *
 * @remarks
 * - Only logs if settings.debug = true
 * - Prefixes with "LS:"
 * - From constitution § 8
 */
export function logDebug(message: string, ...data: any[]): void;

/**
 * Warning logger (always logs)
 */
export function logWarn(message: string, ...data: any[]): void;

/**
 * Error logger (always logs)
 */
export function logError(message: string, ...data: any[]): void;

// ─────────────────────────────────────────────────────────────────────────────
// Constants (shared/constants.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Timing constants
 */
export const TIMING = {
  /** MutationObserver debounce delay */
  DEBOUNCE_MS: 75,

  /** Scroll event throttle delay */
  SCROLL_THROTTLE_MS: 100,

  /** requestIdleCallback batch budget */
  BATCH_BUDGET_MS: 16,

  /** Streaming re-check delay */
  STREAMING_RECHECK_MS: 400,

  /** Message timeout for runtime.sendMessage */
  MESSAGE_TIMEOUT_MS: 500,
} as const;

/**
 * DOM constants
 */
export const DOM = {
  /** Nodes per requestIdleCallback chunk */
  CHUNK_SIZE: 7,

  /** Minimum valid candidates for trimming */
  MIN_CANDIDATES: 6,

  /** Y-coordinate monotonicity tolerance (px) */
  Y_TOLERANCE_PX: 4,

  /** "At bottom" threshold (px from bottom) */
  BOTTOM_THRESHOLD_PX: 100,

  /** Minimum message height (px) */
  MIN_MESSAGE_HEIGHT_PX: 24,
} as const;

/**
 * Selector tier definitions
 * From tz.md § 6.5.4
 */
export const SELECTOR_TIERS: readonly SelectorTier[] = [
  {
    name: 'A',
    description: 'Current UI (data attributes)',
    selectors: ['[data-message-id]', 'article[data-message-id]', '[data-message-author]'],
    minCandidates: 6,
  },
  {
    name: 'B',
    description: 'Fallback (test IDs and roles)',
    selectors: [
      '[data-testid*="message" i]',
      'article[role="article"] [data-testid*="content" i]',
      'div[role="article"]',
    ],
    minCandidates: 6,
  },
  {
    name: 'C',
    description: 'Defensive (structural + content)',
    selectors: ['article', 'div', 'li'],
    minCandidates: 6,
  },
] as const;
