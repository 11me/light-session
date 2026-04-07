/**
 * LightSession for ChatGPT - Chat view helpers
 */

const TURN_SELECTORS = [
  '[data-testid="conversation-turn"]',
  '[data-message-id]',
  '[data-message-author-role]',
  'article',
];

export function hasConversationTurns(root: ParentNode): boolean {
  for (const selector of TURN_SELECTORS) {
    if (root.querySelector(selector)) {
      return true;
    }
  }
  return false;
}

export function countConversationTurns(root: ParentNode): number {
  const main = root.querySelector('main');
  if (!main) {
    return 0;
  }

  for (const selector of ['[data-message-author-role]', '[data-message-id]', '[data-testid="conversation-turn"]', 'article']) {
    const count = main.querySelectorAll(selector).length;
    if (count > 0) {
      return count;
    }
  }

  return 0;
}

export function isEmptyChatView(root: ParentNode): boolean {
  const main = root.querySelector('main');
  if (!main) {
    return false;
  }

  return !hasConversationTurns(main);
}
