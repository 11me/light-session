/**
 * LightSession for ChatGPT - Trimmer State Machine
 * Core trimming logic with state management and batch execution
 */

import type { TrimmerState, LsSettings, NodeInfo } from '../shared/types';
import { TIMING, DOM, DEFAULT_SETTINGS } from '../shared/constants';
import { logDebug, logWarn, logInfo } from '../shared/logger';
import { buildActiveThread, findConversationRoot } from './dom-helpers';
import { isStreaming } from './stream-detector';
import { createDebouncedObserver } from './observers';
import { updateStatusBar } from './status-bar';

/**
 * Initial trimmer state
 */
export function createInitialState(): TrimmerState {
  return {
    current: 'IDLE',
    observer: null,
    trimScheduled: false,
    lastTrimTime: 0,
    conversationRoot: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Boot trimmer: IDLE → OBSERVING
 * Finds conversation root and attaches MutationObserver
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

  const observer = createDebouncedObserver(onMutation, TIMING.DEBOUNCE_MS);
  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  logInfo('Trimmer booted successfully');

  return {
    ...state,
    current: 'OBSERVING',
    observer,
    conversationRoot: root,
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
 * Schedule trim evaluation (debounced)
 */
export function scheduleTrim(state: TrimmerState, evaluateTrimCallback: () => void): TrimmerState {
  if (!state.settings.enabled || state.trimScheduled) {
    return state;
  }

  setTimeout(evaluateTrimCallback, TIMING.DEBOUNCE_MS);

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
 */
export function evaluateTrim(state: TrimmerState, _options: { force?: boolean } = {}): TrimmerState {
  logDebug('=== evaluateTrim called ===');
  logDebug(`Settings: enabled=${state.settings.enabled}, keep=${state.settings.keep}`);

  // Precondition 1: Enabled
  if (!state.settings.enabled) {
    logDebug('Trim evaluation skipped: Disabled');
    return { ...state, current: 'OBSERVING', trimScheduled: false };
  }

  // Precondition 2: Not streaming
  if (isStreaming(state.conversationRoot)) {
    logDebug('Trim evaluation skipped: Streaming in progress');
    return { ...state, current: 'OBSERVING', trimScheduled: false };
  }

  // Build active thread
  logDebug('Building active thread...');
  const nodes = buildActiveThread();
  logDebug(`Built thread with ${nodes.length} nodes`);

  // Precondition 4: Minimum candidate threshold
  if (nodes.length < DOM.MIN_CANDIDATES) {
    logDebug(
      `Trim evaluation skipped: Not enough candidates (${nodes.length} < ${DOM.MIN_CANDIDATES})`
    );
    // Update status bar to show waiting state
    if (state.settings.showStatusBar) {
      updateStatusBar({
        totalMessages: nodes.length,
        visibleMessages: nodes.length,
        trimmedMessages: 0,
        keepLastN: state.settings.keep,
      });
    }
    return { ...state, current: 'OBSERVING', trimScheduled: false };
  }

  // Calculate overflow
  const toKeep = calculateKeepCount(state.settings);
  const overflow = nodes.length - toKeep;

  if (overflow <= 0) {
    logDebug(`Trim evaluation skipped: No overflow (${nodes.length} <= ${toKeep})`);
    // Update status bar with current state (nothing trimmed)
    if (state.settings.showStatusBar) {
      updateStatusBar({
        totalMessages: nodes.length,
        visibleMessages: nodes.length,
        trimmedMessages: 0,
        keepLastN: state.settings.keep,
      });
    }
    return { ...state, current: 'OBSERVING', trimScheduled: false };
  }

  // Determine which nodes to remove (oldest first)
  const toRemove = nodes.slice(0, overflow);

  // Execute trim
  logInfo(`Executing trim: Removing ${toRemove.length} nodes (keeping ${toKeep})`);
  executeTrim(toRemove, state.observer);

  // Update status bar with trimming stats
  if (state.settings.showStatusBar) {
    const visibleAfterTrim = nodes.length - toRemove.length;
    updateStatusBar({
      totalMessages: nodes.length,
      visibleMessages: visibleAfterTrim,
      trimmedMessages: toRemove.length,
      keepLastN: state.settings.keep,
    });
  }

  return {
    ...state,
    current: 'OBSERVING',
    trimScheduled: false,
    lastTrimTime: performance.now(),
  };
}

/**
 * Execute trim in batched chunks using requestIdleCallback
 * Replaces removed nodes with Comment markers
 */
function executeTrim(toRemove: NodeInfo[], observer: MutationObserver | null): void {
  // Disconnect observer during trim to avoid re-triggering
  if (observer) {
    observer.disconnect();
  }

  const startTime = performance.now();
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
      logInfo(`Trim complete: Removed ${removed} nodes in ${totalTime.toFixed(2)}ms`);

      // Re-attach observer
      if (observer) {
        const root = findConversationRoot();
        if (root) {
          observer.observe(root, { childList: true, subtree: true });
        }
      }
    }
  }

  // Start processing
  requestIdleCallback(() => processChunk([...toRemove]), { timeout: 1000 });
}
