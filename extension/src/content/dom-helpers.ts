/**
 * LightSession for ChatGPT - DOM Helpers
 * Role detection, visibility checks, node ID generation, and thread building
 */

import type { MsgRole, NodeInfo } from '../shared/types';
import { DOM } from '../shared/constants';
import { logDebug, logWarn } from '../shared/logger';
import { collectCandidates } from './selectors';

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
 * Filters visible nodes, validates Y-monotonicity, assigns roles and IDs
 */
export function buildActiveThread(): NodeInfo[] {
  const { nodes, tier } = collectCandidates();

  if (nodes.length < DOM.MIN_CANDIDATES) {
    logDebug(`buildActiveThread: Not enough candidates (${nodes.length})`);
    return [];
  }

  // Build NodeInfo array
  const nodeInfos: NodeInfo[] = nodes.filter(isVisible).map((node, index) => ({
    node,
    role: detectRole(node),
    id: getNodeId(node, index),
    y: node.getBoundingClientRect().top,
    visible: true,
  }));

  // Sort by Y-coordinate (should already be sorted, but ensure it)
  nodeInfos.sort((a, b) => a.y - b.y);

  logDebug(`buildActiveThread: Built thread with ${nodeInfos.length} nodes (tier ${tier})`);

  return nodeInfos;
}
