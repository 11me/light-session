/**
 * LightSession for ChatGPT - DOM Helpers
 * Role detection, visibility checks, node ID generation, and thread building
 */

import type { MsgRole, NodeInfo } from '../shared/types';
import { DOM } from '../shared/constants';
import { logDebug, logWarn } from '../shared/logger';
import { collectCandidates, collectCandidatesFast } from './selectors';

/**
 * Detect message role from DOM element
 * Uses data attributes, structural hints, and ARIA roles
 */
export function detectRole(el: HTMLElement): MsgRole {
  // Priority 1: Explicit data attributes
  const author = (
    el.dataset.messageAuthorRole ||
    el.dataset.messageAuthor ||
    el.dataset.role ||
    el.getAttribute('data-author') ||
    ''
  ).toLowerCase();

  if (/system/.test(author)) return 'system';
  if (/tool|function|plugin/.test(author)) return 'tool';
  if (/assistant|model|ai/.test(author)) return 'assistant';
  if (/user|you/.test(author)) return 'user';

  // Priority 2: conversation-turn data attributes
  const turnAttr = el.dataset.turn?.toLowerCase();
  if (turnAttr === 'user') return 'user';
  if (turnAttr === 'assistant') return 'assistant';
  if (turnAttr === 'system') return 'system';
  if (turnAttr === 'tool') return 'tool';

  // Priority 3: Structural/content-based indicators
  if (el.querySelector('[data-testid*="tool" i], [data-tool-call-id]')) {
    return 'tool';
  }

  if (el.querySelector('[data-testid*="copy" i], [data-testid*="regenerate" i]')) {
    return 'assistant';
  }

  // Priority 4: ARIA roles
  const role = el.getAttribute('role');
  if (role === 'status' || role === 'log' || role === 'alert') {
    return 'system';
  }

  // Default: unknown
  logDebug('Could not detect role for element:', el);
  return 'unknown';
}

/**
 * Check if element is visible
 */
export function isVisible(el: HTMLElement): boolean {
  // offsetParent is null if display:none or element is detached
  if (el.offsetParent === null) {
    return false;
  }

  // Check for zero bounding rects
  if (el.getClientRects().length === 0) {
    return false;
  }

  // Check for hidden ancestors
  if (el.closest('[hidden], [aria-hidden="true"]')) {
    return false;
  }

  return true;
}

/**
 * Check if element should be included in thread for trimming.
 *
 * IMPORTANT: content-visibility: auto (used for render optimization) causes
 * offscreen elements to return empty client rects from getClientRects().
 * Using isVisible() would exclude these elements, breaking trimming.
 *
 * For trusted ChatGPT message markers (data-turn, data-message-id), we only
 * check for explicit hiding (hidden attr, aria-hidden, display:none).
 * For other elements (Tier C fallback), we use full isVisible() check.
 */
export function shouldIncludeInThread(el: HTMLElement): boolean {
  // Fast path: trusted ChatGPT message markers
  // These elements ARE messages - only exclude if explicitly hidden
  // Note: we intentionally DON'T check offsetParent here because:
  // - offsetParent is null for position:fixed, display:contents, etc.
  // - Trusted markers are reliable enough to trust without layout checks
  if (el.dataset.turn || el.dataset.messageId) {
    // Only exclude if explicitly hidden via attributes
    if (el.closest('[hidden], [aria-hidden="true"]')) {
      return false;
    }
    return true;
  }

  // Fallback for non-trusted elements: use full visibility check
  return isVisible(el);
}

/**
 * Generate stable ID for a node
 * Prefers data-message-id, falls back to position + content hash
 */
export function getNodeId(el: HTMLElement, index: number): string {
  // Priority 1: data-message-id attribute
  if (el.dataset.messageId) {
    return el.dataset.messageId;
  }

  // Priority 2: Hash of position + content prefix
  const contentPrefix = el.textContent?.slice(0, 50) || '';
  return `msg-${index}-${simpleHash(contentPrefix)}`;
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Find the conversation root element (scrollable container)
 * This is where MutationObserver will be attached
 */
export function findConversationRoot(): HTMLElement | null {
  // Try common conversation container selectors
  const selectors = [
    'main[class*="conversation" i]',
    '[role="main"]',
    'main',
    '[class*="thread" i]',
    '[class*="conversation" i]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      logDebug(`Found conversation root: ${selector}`);
      return el;
    }
  }

  logWarn('Could not find conversation root, falling back to document.body');
  return document.body;
}

/**
 * Find the scrollable ancestor of an element
 */
export function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const overflow = style.overflow + style.overflowY + style.overflowX;

    if (/(auto|scroll)/.test(overflow) && current.scrollHeight > current.clientHeight) {
      logDebug('Found scrollable ancestor:', current);
      return current;
    }

    current = current.parentElement;
  }

  // Fallback to window scroll
  logDebug('No scrollable ancestor found, using document.documentElement');
  return document.documentElement;
}

/**
 * Build NodeInfo array for active thread
 * Filters visible nodes, assigns roles and IDs
 *
 * Note: We trust DOM order instead of Y-coordinate sorting because:
 * 1. NodeList from querySelectorAll is already in document order
 * 2. content-visibility: auto breaks getBoundingClientRect() for offscreen elements
 * 3. DOM order is more reliable and doesn't trigger layout
 */
export function buildActiveThread(): NodeInfo[] {
  const { nodes, tier } = collectCandidates();

  if (nodes.length < DOM.MIN_CANDIDATES) {
    logDebug(`buildActiveThread: Not enough candidates (${nodes.length})`);
    return [];
  }

  // Build NodeInfo array - trust DOM order, no Y-sorting needed
  // Use shouldIncludeInThread instead of isVisible to handle content-visibility: auto
  // which makes offscreen elements return empty client rects
  const nodeInfos: NodeInfo[] = nodes.filter(shouldIncludeInThread).map((node, index) => ({
    node,
    role: detectRole(node),
    id: getNodeId(node, index),
    y: index, // Use index as pseudo-Y (DOM order is correct)
    visible: true,
  }));

  logDebug(`buildActiveThread: Built thread with ${nodeInfos.length} nodes (tier ${tier})`);

  return nodeInfos;
}

/**
 * Layout-read-free version of buildActiveThread for BOOT mode.
 * Avoids getBoundingClientRect, isVisible, and other layout-triggering calls.
 * Trusts DOM order instead of visual order (Y-coordinate sorting).
 *
 * This is critical for pre-paint trimming where layout reads would
 * force the browser to compute layout before we can trim, defeating
 * the purpose of BOOT mode.
 *
 * Trade-offs:
 * - Less accurate: may include hidden elements or wrong order
 * - Much faster: no forced layout/reflow
 * - For BOOT mode, speed is more important than perfect accuracy
 */
export function buildActiveThreadFast(): NodeInfo[] {
  const { nodes, tier } = collectCandidatesFast();

  if (nodes.length < DOM.MIN_CANDIDATES) {
    logDebug(`buildActiveThreadFast: Not enough candidates (${nodes.length})`);
    return [];
  }

  // Build NodeInfo array without layout reads
  // Trust DOM order - no Y-coordinate sorting
  // Y is set to index for ordering (avoids getBoundingClientRect)
  const nodeInfos: NodeInfo[] = nodes.map((node, index) => ({
    node,
    role: detectRole(node),
    id: getNodeId(node, index),
    y: index, // Use index as pseudo-Y to maintain DOM order
    visible: true, // Assume visible (skip isVisible check)
  }));

  logDebug(`buildActiveThreadFast: Built thread with ${nodeInfos.length} nodes (tier ${tier})`);

  return nodeInfos;
}
