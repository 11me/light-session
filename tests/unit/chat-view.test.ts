/**
 * Tests for chat view helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  countConversationTurns,
  hasConversationTurns,
  isEmptyChatView,
} from '../../extension/src/content/chat-view';

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

  it('counts visible turns using author-role nodes first', () => {
    document.body.innerHTML =
      '<main><div data-message-author-role="user"></div><div data-message-author-role="assistant"></div></main>';

    expect(countConversationTurns(document)).toBe(2);
  });

  it('falls back to message-id nodes when author-role nodes are absent', () => {
    document.body.innerHTML =
      '<main><div data-message-id="u1"></div><div data-message-id="a1"></div><div data-message-id="u2"></div></main>';

    expect(countConversationTurns(document)).toBe(3);
  });

  it('returns zero when main has no detected turns', () => {
    document.body.innerHTML = '<main><div>No messages</div></main>';

    expect(countConversationTurns(document)).toBe(0);
  });
});
