/**
 * Tests for chat view helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { hasConversationTurns, isEmptyChatView } from '../../extension/src/content/chat-view';

describe('chat view helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects empty chat view when main has no turns', () => {
    document.body.innerHTML = '<main><div>No messages</div></main>';

    expect(isEmptyChatView(document)).toBe(true);
  });

  it('detects conversation turns by data-testid', () => {
    document.body.innerHTML = '<main><div data-testid="conversation-turn"></div></main>';

    expect(hasConversationTurns(document)).toBe(true);
    expect(isEmptyChatView(document)).toBe(false);
  });

  it('detects conversation turns by message id', () => {
    document.body.innerHTML = '<main><div data-message-id="abc"></div></main>';

    expect(hasConversationTurns(document)).toBe(true);
    expect(isEmptyChatView(document)).toBe(false);
  });

  it('detects conversation turns by author role', () => {
    document.body.innerHTML = '<main><div data-message-author-role="assistant"></div></main>';

    expect(hasConversationTurns(document)).toBe(true);
    expect(isEmptyChatView(document)).toBe(false);
  });

  it('detects conversation turns by article elements', () => {
    document.body.innerHTML = '<main><article>Hi</article></main>';

    expect(hasConversationTurns(document)).toBe(true);
    expect(isEmptyChatView(document)).toBe(false);
  });
});
