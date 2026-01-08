/**
 * LightSession for ChatGPT - Constants
 * All magic numbers, timing values, and selector definitions
 */

import type { LsSettings } from './types';

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_SETTINGS: Readonly<LsSettings> = {
  version: 1,
  enabled: true,
  keep: 10,
  showStatusBar: true,
  debug: false,
  ultraLean: false,
} as const;

// ============================================================================
// Timing Constants
// ============================================================================

export const TIMING = {
  /**
   * Duration of BOOT mode after page load/navigation (ms).
   *
   * Rationale:
   * - BOOT mode uses queueMicrotask for instant trimming before paint
   * - 1500ms covers typical ChatGPT page load + initial render
   * - After this, switch to STEADY mode with debouncing for efficiency
   * - Too short: may miss initial large DOM loads
   * - Too long: wastes CPU on frequent microtask scheduling
   */
  BOOT_DURATION_MS: 1500,

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

  /**
   * Timeout for fetch proxy ready signal (ms).
   *
   * Rationale:
   * - Page script should signal ready within a few hundred ms
   * - 1000ms provides margin for slow page loads
   * - If timeout fires, proxy may still work (just missed the signal)
   */
  PROXY_READY_TIMEOUT_MS: 1000,

  /**
   * Throttle interval for status bar DOM updates (ms).
   *
   * Rationale:
   * - 500ms reduces DOM writes during active chat streaming
   * - Prevents excessive repaints while still feeling responsive
   * - Status bar is informational, doesn't need real-time updates
   */
  STATUS_BAR_THROTTLE_MS: 500,
} as const;

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

export const SUPPORT_URL = 'https://github.com/11me/light-session?tab=readme-ov-file#%EF%B8%8F-support' as const;
