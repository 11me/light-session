/**
 * LightSession for ChatGPT - Trimmer State Machine
 * Core trimming logic with state management and batch execution
 *
 * Two trim modes:
 * - BOOT: First ~1.5s after load/navigation. Uses queueMicrotask for instant
 *   trimming BEFORE browser paints. No debounce, layout-read-free.
 * - STEADY: After stabilization. Uses debounced callbacks + requestIdleCallback
 *   for efficient, non-blocking trimming.
 */

import type { TrimmerState, LsSettings, NodeInfo, EvaluateTrimOptions, TrimMode } from '../shared/types';
import { TIMING, DOM, DEFAULT_SETTINGS } from '../shared/constants';
import { logDebug, logWarn, logInfo, logError } from '../shared/logger';
import { buildActiveThread, buildActiveThreadFast, findConversationRoot } from './dom-helpers';
import { isStreaming } from './stream-detector';
import { createAdaptiveObserver } from './observers';
import { updateStatusBar } from './status-bar';

// Flag to track if first successful trim happened (for early BOOT exit)
let firstTrimCompleted = false;

/**
 * Initial trimmer state
 */
export function createInitialState(): TrimmerState {
  // Reset first trim flag when creating new state
  firstTrimCompleted = false;

  return {
    current: 'IDLE',
    observer: null,
    trimScheduled: false,
    lastTrimTime: 0,
    conversationRoot: null,
    settings: { ...DEFAULT_SETTINGS },
    trimMode: 'BOOT',
    bootStartTime: 0,
  };
}

/**
 * Check if BOOT mode should end
 * Ends when: duration elapsed OR first successful trim completed
 */
export function shouldExitBootMode(state: TrimmerState): boolean {
  if (state.trimMode !== 'BOOT') {
    return false;
  }

  // Exit early if first trim completed successfully
  if (firstTrimCompleted) {
    return true;
  }

  // Exit after duration elapsed
  const elapsed = performance.now() - state.bootStartTime;
  return elapsed >= TIMING.BOOT_DURATION_MS;
}

/**
 * Mark first trim as completed (triggers early BOOT exit)
 */
export function markFirstTrimCompleted(): void {
  if (!firstTrimCompleted) {
    firstTrimCompleted = true;
    logInfo('First trim completed, will transition to STEADY mode');
  }
}

/**
 * Transition from BOOT to STEADY mode if conditions met
 * Conditions: duration elapsed OR first successful trim
 */
export function maybeTransitionToSteady(
  state: TrimmerState,
  onMutation: () => void
): TrimmerState {
  if (state.trimMode !== 'BOOT' || !shouldExitBootMode(state)) {
    return state;
  }

  const reason = firstTrimCompleted
    ? 'first trim completed'
    : `${TIMING.BOOT_DURATION_MS}ms elapsed`;
  logInfo(`Transitioning from BOOT to STEADY mode (${reason})`);

  // Disconnect current observer and create a new debounced one
  if (state.observer) {
    state.observer.disconnect();
  }

  const root = state.conversationRoot ?? findConversationRoot();
  if (!root) {
    return { ...state, trimMode: 'STEADY' };
  }

  const newObserver = createAdaptiveObserver(onMutation, 'STEADY');
  newObserver.observe(root, OBSERVER_CONFIG);

  return {
    ...state,
    trimMode: 'STEADY',
    observer: newObserver,
    conversationRoot: root,
  };
}

/**
 * MutationObserver configuration shared between boot and reattach
 */
const OBSERVER_CONFIG: MutationObserverInit = {
  childList: true,
  subtree: true,
  // Monitor specific attributes that indicate message changes
  // This reduces callback invocations for unrelated DOM changes
  attributes: true,
  attributeFilter: [
    'data-turn',
    'data-message-id',
    'data-message-author-role',
    'hidden',
    'aria-hidden',
  ],
};

/**
 * Boot trimmer: IDLE → OBSERVING
 * Finds conversation root and attaches MutationObserver
 * Starts in BOOT mode for aggressive pre-paint trimming
 */
export function boot(state: TrimmerState, onMutation: () => void): TrimmerState {
  if (state.current !== 'IDLE') {
    logWarn('Cannot boot: Already active');
    return state;
  }

  const root = findConversationRoot();
  if (!root) {
    logWarn('Cannot boot: Conversation root not found');
    return state;
  }

  // Reset per-boot flag to ensure clean BOOT cycle
  firstTrimCompleted = false;

  // Start in BOOT mode for aggressive trimming before first paint
  const trimMode: TrimMode = 'BOOT';
  const bootStartTime = performance.now();

  const observer = createAdaptiveObserver(onMutation, trimMode);
  observer.observe(root, OBSERVER_CONFIG);

  logInfo(`Trimmer booted in ${trimMode} mode`);

  return {
    ...state,
    current: 'OBSERVING',
    observer,
    conversationRoot: root,
    trimMode,
    bootStartTime,
  };
}

/**
 * Shutdown trimmer: * → IDLE
 * Disconnects observer and cleans up
 */
export function shutdown(state: TrimmerState): TrimmerState {
  if (state.observer) {
    state.observer.disconnect();
  }

  logInfo('Trimmer shut down');

  return {
    ...createInitialState(),
    settings: state.settings, // Preserve settings
  };
}

/**
 * Schedule trim evaluation with mode-adaptive scheduling
 *
 * BOOT mode: queueMicrotask for instant execution before paint
 * STEADY mode: setTimeout with debounce for batching
 *
 * @param state Current trimmer state
 * @param evaluateTrimCallback Callback to evaluate and execute trim
 * @param onComplete Optional callback invoked after trim completes (success or error)
 *                   Used to reset trimScheduled flag in caller's state
 */
export function scheduleTrim(
  state: TrimmerState,
  evaluateTrimCallback: () => void,
  onComplete?: () => void
): TrimmerState {
  if (!state.settings.enabled || state.trimScheduled) {
    return state;
  }

  const executeWithErrorHandling = (): void => {
    try {
      evaluateTrimCallback();
    } catch (error) {
      logError('Trim evaluation failed:', error);
    } finally {
      // Always invoke onComplete to allow caller to reset trimScheduled
      // This ensures state doesn't get stuck if callback throws
      onComplete?.();
    }
  };

  if (state.trimMode === 'BOOT') {
    // BOOT mode: immediate execution via microtask
    // This runs BEFORE the browser paints, preventing "flash" of untrimmed content
    queueMicrotask(executeWithErrorHandling);
  } else {
    // STEADY mode: debounced execution for efficiency
    setTimeout(executeWithErrorHandling, TIMING.DEBOUNCE_MS);
  }

  return { ...state, trimScheduled: true };
}

/**
 * Calculate how many nodes to keep
 */
export function calculateKeepCount(settings: LsSettings): number {
  return settings.keep;
}

/**
 * Evaluate trim: Check preconditions and execute if met
 * PENDING_TRIM → TRIMMING or back to OBSERVING
 *
 * @param state Current trimmer state
 * @param options Evaluation options including optional settings snapshot
 *                Using a settings snapshot prevents race conditions when
 *                settings change during async trim scheduling
 */
export function evaluateTrim(state: TrimmerState, options: EvaluateTrimOptions = {}): TrimmerState {
  // Use provided settings snapshot or fall back to current state settings
  // This prevents race conditions when settings change between scheduling and execution
  const settings = options.settings ?? state.settings;

  logDebug('=== evaluateTrim called ===');
  logDebug(`Settings: enabled=${settings.enabled}, keep=${settings.keep}, mode=${state.trimMode}`);

  // Precondition 1: Enabled
  if (!settings.enabled) {
    logDebug('Trim evaluation skipped: Disabled');
    return { ...state, current: 'OBSERVING', trimScheduled: false };
  }

  // Precondition 2: Not streaming (skip in BOOT mode for speed)
  if (state.trimMode !== 'BOOT' && isStreaming(state.conversationRoot)) {
    logDebug('Trim evaluation skipped: Streaming in progress');
    return { ...state, current: 'OBSERVING', trimScheduled: false };
  }

  // Build active thread using mode-appropriate strategy
  // BOOT: layout-read-free for pre-paint trimming
  // STEADY: full validation for accuracy
  logDebug(`Building active thread [${state.trimMode}]...`);
  const nodes = state.trimMode === 'BOOT' ? buildActiveThreadFast() : buildActiveThread();
  logDebug(`Built thread with ${nodes.length} nodes`);

  // Precondition 4: Minimum candidate threshold
  if (nodes.length < DOM.MIN_CANDIDATES) {
    logDebug(
      `Trim evaluation skipped: Not enough candidates (${nodes.length} < ${DOM.MIN_CANDIDATES})`
    );
    // Update status bar to show waiting state
    if (settings.showStatusBar) {
      updateStatusBar({
        totalMessages: nodes.length,
        visibleMessages: nodes.length,
        trimmedMessages: 0,
        keepLastN: settings.keep,
      });
    }
    return { ...state, current: 'OBSERVING', trimScheduled: false };
  }

  // Calculate overflow
  const toKeep = calculateKeepCount(settings);
  const overflow = nodes.length - toKeep;

  if (overflow <= 0) {
    logDebug(`Trim evaluation skipped: No overflow (${nodes.length} <= ${toKeep})`);
    // Update status bar with current state (nothing trimmed)
    if (settings.showStatusBar) {
      updateStatusBar({
        totalMessages: nodes.length,
        visibleMessages: nodes.length,
        trimmedMessages: 0,
        keepLastN: settings.keep,
      });
    }
    return { ...state, current: 'OBSERVING', trimScheduled: false };
  }

  // Determine which nodes to remove (oldest first)
  const toRemove = nodes.slice(0, overflow);

  // Execute trim with mode-specific strategy
  logInfo(`Executing trim [${state.trimMode}]: Removing ${toRemove.length} nodes (keeping ${toKeep})`);
  executeTrim(toRemove, state.observer, state.trimMode);

  // Mark first trim as completed (triggers early BOOT→STEADY transition)
  if (state.trimMode === 'BOOT') {
    markFirstTrimCompleted();
  }

  // Update status bar with trimming stats
  if (settings.showStatusBar) {
    const visibleAfterTrim = nodes.length - toRemove.length;
    updateStatusBar({
      totalMessages: nodes.length,
      visibleMessages: visibleAfterTrim,
      trimmedMessages: toRemove.length,
      keepLastN: settings.keep,
    });
  }

  return {
    ...state,
    current: 'OBSERVING',
    trimScheduled: false,
    lastTrimTime: performance.now(),
  };
}

// Callback invoked when trim completes to handle potential missed mutations
let onTrimCompleteCallback: (() => void) | null = null;

/**
 * Set a callback to be invoked when trim completes.
 * Used to re-evaluate DOM after observer reconnection in case mutations
 * occurred while observer was disconnected.
 */
export function setOnTrimComplete(callback: (() => void) | null): void {
  onTrimCompleteCallback = callback;
}

/**
 * Execute trim with mode-specific strategy
 *
 * BOOT mode: Synchronous removal for instant effect before paint
 * STEADY mode: Batched chunks via requestIdleCallback for smooth UX
 *
 * Replaces removed nodes with Comment markers
 */
function executeTrim(
  toRemove: NodeInfo[],
  observer: MutationObserver | null,
  mode: TrimMode
): void {
  // Disconnect observer during trim to avoid re-triggering
  if (observer) {
    observer.disconnect();
  }

  const startTime = performance.now();

  if (mode === 'BOOT') {
    // BOOT mode: synchronous removal for instant effect before paint
    // This is critical for preventing "flash" of untrimmed content
    executeTrimSync(toRemove, observer, startTime);
  } else {
    // STEADY mode: batched removal for smooth UX
    executeTrimBatched(toRemove, observer, startTime);
  }
}

/**
 * Synchronous trim execution for BOOT mode
 * Removes all nodes immediately to prevent paint of untrimmed content
 */
function executeTrimSync(
  toRemove: NodeInfo[],
  observer: MutationObserver | null,
  startTime: number
): void {
  let removed = 0;

  for (const nodeInfo of toRemove) {
    try {
      const parent = nodeInfo.node.parentNode;
      if (parent) {
        // Replace with comment marker
        const marker = document.createComment(
          `${DOM.REMOVAL_MARKER}-${nodeInfo.id}-${nodeInfo.role}`
        );
        parent.replaceChild(marker, nodeInfo.node);
        removed++;
      }
    } catch (error) {
      logWarn('Failed to remove node:', error);
    }
  }

  const totalTime = performance.now() - startTime;
  logInfo(`Trim complete [BOOT sync]: Removed ${removed} nodes in ${totalTime.toFixed(2)}ms`);

  // Re-attach observer
  reattachObserver(observer);

  // Invoke callback to handle potential missed mutations
  if (onTrimCompleteCallback) {
    queueMicrotask(onTrimCompleteCallback);
  }
}

/**
 * Batched trim execution for STEADY mode
 * Uses requestIdleCallback to avoid jank
 */
function executeTrimBatched(
  toRemove: NodeInfo[],
  observer: MutationObserver | null,
  startTime: number
): void {
  let removed = 0;

  // Process in chunks
  function processChunk(nodes: NodeInfo[]): void {
    const chunkStartTime = performance.now();
    let processed = 0;

    while (processed < TIMING.NODES_PER_BATCH && nodes.length > 0) {
      const nodeInfo = nodes.shift();
      if (!nodeInfo) break;

      try {
        const parent = nodeInfo.node.parentNode;
        if (parent) {
          // Replace with comment marker
          const marker = document.createComment(
            `${DOM.REMOVAL_MARKER}-${nodeInfo.id}-${nodeInfo.role}`
          );
          parent.replaceChild(marker, nodeInfo.node);
          removed++;
        }
      } catch (error) {
        logWarn('Failed to remove node:', error);
      }

      processed++;

      // Budget check
      const elapsed = performance.now() - chunkStartTime;
      if (elapsed > TIMING.BATCH_BUDGET_MS) {
        break;
      }
    }

    // Schedule next chunk if needed
    if (nodes.length > 0) {
      requestIdleCallback(() => processChunk(nodes), { timeout: 1000 });
    } else {
      // Trim complete
      const totalTime = performance.now() - startTime;
      logInfo(`Trim complete [STEADY batched]: Removed ${removed} nodes in ${totalTime.toFixed(2)}ms`);

      // Re-attach observer
      reattachObserver(observer);

      // Invoke callback to handle potential missed mutations
      // This allows re-evaluation of DOM after observer reconnection
      if (onTrimCompleteCallback) {
        // Use setTimeout to allow observer to settle before re-evaluation
        setTimeout(onTrimCompleteCallback, 0);
      }
    }
  }

  // Start processing
  requestIdleCallback(() => processChunk([...toRemove]), { timeout: 1000 });
}

/**
 * Re-attach MutationObserver after trim completes
 */
function reattachObserver(observer: MutationObserver | null): void {
  if (!observer) {
    return;
  }

  const root = findConversationRoot();
  if (root) {
    observer.observe(root, OBSERVER_CONFIG);
  }
}
