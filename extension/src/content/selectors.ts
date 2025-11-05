/**
 * LightSession for ChatGPT - Selector Strategies
 * Multi-tier selector system for DOM resilience
 */

import type { SelectorTierName } from '../shared/types';
import { SELECTOR_TIERS, DOM } from '../shared/constants';
import { logDebug, logWarn } from '../shared/logger';

/**
 * Collect candidate message nodes using multi-tier selector strategy
 * Tries Tier A first, falls back to B, then C
 * @returns Object containing nodes array and tier used (or null if all tiers failed)
 */
export function collectCandidates(): { nodes: HTMLElement[]; tier: SelectorTierName | null } {
  logDebug('collectCandidates: Starting selector tier search...');

  for (const tier of SELECTOR_TIERS) {
    // Query all selectors for this tier and de-duplicate
    const nodes = [
      ...new Set(
        tier.selectors.flatMap((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)))
      ),
    ];

    logDebug(`Tier ${tier.name}: Found ${nodes.length} raw nodes before filtering`);

    // Filter using heuristics (especially important for Tier C)
    const filtered = nodes.filter(isLikelyMessage);

    logDebug(`Tier ${tier.name}: ${filtered.length} nodes after isLikelyMessage filter`);

    // Validate sequence before accepting this tier
    if (filtered.length >= tier.minCandidates && isSequenceValid(filtered)) {
      logDebug(
        `Using selector tier ${tier.name} (${tier.description}): ${filtered.length} candidates`
      );
      return { nodes: filtered, tier: tier.name };
    }

    logDebug(
      `Tier ${tier.name} failed: ${filtered.length} candidates (min: ${tier.minCandidates}), valid sequence: ${isSequenceValid(filtered)}`
    );
  }

  // Fallback: probe for data-testid based ChatGPT DOM patterns (post 2024 UI)
  const fallbackSelectors = [
    '[data-testid="conversation-turn"]',
    '[data-testid^="conversation-turn-"]',
    '[data-testid="assistant-turn"]',
    '[data-testid="user-turn"]',
    'div[class*="conversation-turn" i] article',
    'section[aria-label*="chat history" i] article'
  ];

  const fallbackNodes = [
    ...new Set(
      fallbackSelectors.flatMap((selector) =>
        Array.from(document.querySelectorAll<HTMLElement>(selector))
      )
    ),
  ].filter(isLikelyMessage);

  if (fallbackNodes.length >= DOM.MIN_CANDIDATES) {
    logDebug(
      'Fallback selectors succeeded: ' +
        fallbackNodes.length +
        ' candidates using data-testid heuristics'
    );
    return { nodes: fallbackNodes, tier: null };
  }

  logWarn('All selector tiers failed to find valid candidates');
  return { nodes: [], tier: null };
}

/**
 * Heuristic to determine if an element is likely a message node
 * Used primarily for Tier C filtering
 */
function isLikelyMessage(el: HTMLElement): boolean {
  // Fast path: ChatGPT conversation containers expose data-turn with roles
  if (el.dataset.turn) {
    return isVisible(el);
  }

  // Must be visible (basic check)
  if (!isVisible(el)) {
    return false;
  }

  // Exclude critical page elements by tag first (most important check)
  const tagName = el.tagName.toLowerCase();
  if (tagName === 'main' || tagName === 'nav' || tagName === 'header' || tagName === 'footer' || tagName === 'body') {
    return false;
  }

  // Safety check: Don't select elements with too many descendants (page containers)
  // Only apply this to elements with suspiciously many children
  const descendantCount = el.querySelectorAll('*').length;
  if (descendantCount > 500) {
    return false; // Definitely a major container
  }

  // Must have reasonable height (messages are typically >50px)
  const rect = el.getBoundingClientRect();
  if (rect.height < 50) {
    return false;
  }

  // Must contain some text content
  const text = el.textContent?.trim() || '';
  if (text.length < 10) {
    return false;
  }

  // Exclude elements that are clearly not messages
  const classList = el.className.toLowerCase();
  if (
    classList.includes('header') ||
    classList.includes('footer') ||
    classList.includes('sidebar') ||
    classList.includes('menu')
  ) {
    return false;
  }

  return true;
}

/**
 * Check if element is visible (not hidden)
 */
function isVisible(el: HTMLElement): boolean {
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
 * Validate that nodes form a monotonically increasing sequence by Y-coordinate
 * Allows small violations (±4px) for layout shifts
 */
function isSequenceValid(nodes: HTMLElement[]): boolean {
  if (nodes.length < 2) {
    return true;
  }

  for (let i = 1; i < nodes.length; i++) {
    const prevY = nodes[i - 1].getBoundingClientRect().top;
    const currY = nodes[i].getBoundingClientRect().top;

    if (currY < prevY - DOM.Y_TOLERANCE_PX) {
      logWarn(`Y-coordinate non-monotonic at index ${i}: ${currY} < ${prevY}`);
      return false;
    }
  }

  return true;
}
