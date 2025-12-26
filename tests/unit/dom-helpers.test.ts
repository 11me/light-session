/**
 * Unit tests for dom-helpers.ts
 * Tests role detection, node ID generation, visibility checks, and DOM traversal
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MsgRole } from '../../extension/src/shared/types';

// Mock the logger module
vi.mock('../../extension/src/shared/logger', () => ({
  logDebug: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  setDebugMode: vi.fn(),
  isDebugMode: vi.fn(() => false),
}));

// Mock the selectors module
vi.mock('../../extension/src/content/selectors', () => ({
  collectCandidates: vi.fn(() => ({ nodes: [], tier: 'A' })),
}));

// Import after mocks
import {
  detectRole,
  getNodeId,
  isVisible,
  findConversationRoot,
  findScrollableAncestor,
  buildActiveThread,
} from '../../extension/src/content/dom-helpers';
import { collectCandidates } from '../../extension/src/content/selectors';

describe('dom-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectRole', () => {
    it('should detect system role from data-message-author-role', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'system';
      expect(detectRole(el)).toBe('system');
    });

    it('should detect assistant role from data-message-author-role', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'assistant';
      expect(detectRole(el)).toBe('assistant');
    });

    it('should detect user role from data-message-author-role', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'user';
      expect(detectRole(el)).toBe('user');
    });

    it('should detect tool role from data-message-author-role', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'tool';
      expect(detectRole(el)).toBe('tool');
    });

    it('should detect role from data-message-author (fallback)', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthor = 'AI';
      expect(detectRole(el)).toBe('assistant');
    });

    it('should detect role from data-role attribute', () => {
      const el = document.createElement('div');
      el.dataset.role = 'model';
      expect(detectRole(el)).toBe('assistant');
    });

    it('should detect role from data-author attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('data-author', 'user');
      expect(detectRole(el)).toBe('user');
    });

    it('should be case-insensitive when matching role attributes', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'ASSISTANT';
      expect(detectRole(el)).toBe('assistant');
    });

    it('should detect role from data-turn attribute', () => {
      const el = document.createElement('div');
      el.dataset.turn = 'user';
      expect(detectRole(el)).toBe('user');
    });

    it('should detect assistant from data-turn attribute', () => {
      const el = document.createElement('div');
      el.dataset.turn = 'assistant';
      expect(detectRole(el)).toBe('assistant');
    });

    it('should detect system from data-turn attribute', () => {
      const el = document.createElement('div');
      el.dataset.turn = 'system';
      expect(detectRole(el)).toBe('system');
    });

    it('should detect tool from data-turn attribute', () => {
      const el = document.createElement('div');
      el.dataset.turn = 'tool';
      expect(detectRole(el)).toBe('tool');
    });

    it('should detect tool role from child with data-testid containing "tool"', () => {
      const el = document.createElement('div');
      const child = document.createElement('span');
      child.setAttribute('data-testid', 'tool-output');
      el.appendChild(child);
      expect(detectRole(el)).toBe('tool');
    });

    it('should detect tool role from child with data-tool-call-id', () => {
      const el = document.createElement('div');
      const child = document.createElement('span');
      child.setAttribute('data-tool-call-id', 'call_123');
      el.appendChild(child);
      expect(detectRole(el)).toBe('tool');
    });

    it('should detect assistant role from child with copy button testid', () => {
      const el = document.createElement('div');
      const child = document.createElement('button');
      child.setAttribute('data-testid', 'copy-button');
      el.appendChild(child);
      expect(detectRole(el)).toBe('assistant');
    });

    it('should detect assistant role from child with regenerate button testid', () => {
      const el = document.createElement('div');
      const child = document.createElement('button');
      child.setAttribute('data-testid', 'regenerate-button');
      el.appendChild(child);
      expect(detectRole(el)).toBe('assistant');
    });

    it('should detect system role from ARIA role status', () => {
      const el = document.createElement('div');
      el.setAttribute('role', 'status');
      expect(detectRole(el)).toBe('system');
    });

    it('should detect system role from ARIA role log', () => {
      const el = document.createElement('div');
      el.setAttribute('role', 'log');
      expect(detectRole(el)).toBe('system');
    });

    it('should detect system role from ARIA role alert', () => {
      const el = document.createElement('div');
      el.setAttribute('role', 'alert');
      expect(detectRole(el)).toBe('system');
    });

    it('should return unknown when no role indicators are present', () => {
      const el = document.createElement('div');
      expect(detectRole(el)).toBe('unknown');
    });

    it('should handle empty string attributes', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = '';
      expect(detectRole(el)).toBe('unknown');
    });

    it('should match partial keywords in role attributes', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'system-message';
      expect(detectRole(el)).toBe('system');
    });

    it('should detect function role as tool', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'function';
      expect(detectRole(el)).toBe('tool');
    });

    it('should detect plugin role as tool', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'plugin';
      expect(detectRole(el)).toBe('tool');
    });

    it('should prioritize data-message-author-role over data-turn', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'user';
      el.dataset.turn = 'assistant';
      expect(detectRole(el)).toBe('user');
    });

    it('should prioritize data attributes over structural hints', () => {
      const el = document.createElement('div');
      el.dataset.messageAuthorRole = 'user';
      const child = document.createElement('button');
      child.setAttribute('data-testid', 'copy-button');
      el.appendChild(child);
      expect(detectRole(el)).toBe('user');
    });

    it('should prioritize structural hints over ARIA roles', () => {
      const el = document.createElement('div');
      el.setAttribute('role', 'status');
      const child = document.createElement('button');
      child.setAttribute('data-testid', 'regenerate-button');
      el.appendChild(child);
      expect(detectRole(el)).toBe('assistant');
    });
  });

  describe('getNodeId', () => {
    it('should return data-message-id when present', () => {
      const el = document.createElement('div');
      el.dataset.messageId = 'msg-abc-123';
      expect(getNodeId(el, 0)).toBe('msg-abc-123');
    });

    it('should generate ID from index and content hash when no data-message-id', () => {
      const el = document.createElement('div');
      el.textContent = 'Hello world';
      const id = getNodeId(el, 5);
      expect(id).toMatch(/^msg-5-[a-z0-9]+$/);
    });

    it('should generate consistent hash for same content', () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      el1.textContent = 'Test content';
      el2.textContent = 'Test content';
      const id1 = getNodeId(el1, 0);
      const id2 = getNodeId(el2, 0);
      expect(id1).toBe(id2);
    });

    it('should generate different hashes for different content', () => {
      const el1 = document.createElement('div');
      const el2 = document.createElement('div');
      el1.textContent = 'Content A';
      el2.textContent = 'Content B';
      const id1 = getNodeId(el1, 0);
      const id2 = getNodeId(el2, 0);
      expect(id1).not.toBe(id2);
    });

    it('should handle empty text content', () => {
      const el = document.createElement('div');
      el.textContent = '';
      const id = getNodeId(el, 3);
      expect(id).toMatch(/^msg-3-[a-z0-9]+$/);
    });

    it('should handle null text content', () => {
      const el = document.createElement('div');
      const id = getNodeId(el, 7);
      expect(id).toMatch(/^msg-7-[a-z0-9]+$/);
    });

    it('should use only first 50 characters of content for hash', () => {
      const el = document.createElement('div');
      const longText = 'a'.repeat(100);
      el.textContent = longText;
      const id = getNodeId(el, 1);
      expect(id).toMatch(/^msg-1-[a-z0-9]+$/);
    });

    it('should include index in generated ID', () => {
      const el = document.createElement('div');
      el.textContent = 'test';
      expect(getNodeId(el, 0)).toContain('msg-0-');
      expect(getNodeId(el, 42)).toContain('msg-42-');
    });
  });

  describe('isVisible', () => {
    it('should return false when element has no offsetParent', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      // Mock offsetParent to be null (simulates display:none or detached)
      Object.defineProperty(el, 'offsetParent', {
        get: () => null,
        configurable: true,
      });

      expect(isVisible(el)).toBe(false);
    });

    it('should return false when element is in a hidden container', () => {
      const container = document.createElement('div');
      container.setAttribute('hidden', '');
      const el = document.createElement('div');
      container.appendChild(el);
      document.body.appendChild(container);
      expect(isVisible(el)).toBe(false);
    });

    it('should return false when element has aria-hidden ancestor', () => {
      const container = document.createElement('div');
      container.setAttribute('aria-hidden', 'true');
      const el = document.createElement('div');
      container.appendChild(el);
      document.body.appendChild(container);
      expect(isVisible(el)).toBe(false);
    });

    it('should return true when element is visible', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      // Mock offsetParent to simulate visible element
      Object.defineProperty(el, 'offsetParent', {
        get: () => document.body,
        configurable: true,
      });

      // Mock getClientRects to return non-empty array
      vi.spyOn(el, 'getClientRects').mockReturnValue([
        {
          top: 0,
          left: 0,
          right: 100,
          bottom: 100,
          width: 100,
          height: 100,
          x: 0,
          y: 0,
        } as DOMRect,
      ] as DOMRectList);

      expect(isVisible(el)).toBe(true);
    });

    it('should return false when getClientRects returns empty array', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      Object.defineProperty(el, 'offsetParent', {
        get: () => document.body,
        configurable: true,
      });

      vi.spyOn(el, 'getClientRects').mockReturnValue([] as unknown as DOMRectList);

      expect(isVisible(el)).toBe(false);
    });
  });

  describe('findConversationRoot', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should find main element with conversation class', () => {
      const main = document.createElement('main');
      main.className = 'conversation-container';
      document.body.appendChild(main);

      const result = findConversationRoot();
      expect(result).toBe(main);
    });

    it('should find element with role=main', () => {
      const main = document.createElement('div');
      main.setAttribute('role', 'main');
      document.body.appendChild(main);

      const result = findConversationRoot();
      expect(result).toBe(main);
    });

    it('should find main element', () => {
      const main = document.createElement('main');
      document.body.appendChild(main);

      const result = findConversationRoot();
      expect(result).toBe(main);
    });

    it('should find element with thread class', () => {
      const thread = document.createElement('div');
      thread.className = 'thread-container';
      document.body.appendChild(thread);

      const result = findConversationRoot();
      expect(result).toBe(thread);
    });

    it('should find element with conversation class', () => {
      const conv = document.createElement('div');
      conv.className = 'conversation-list';
      document.body.appendChild(conv);

      const result = findConversationRoot();
      expect(result).toBe(conv);
    });

    it('should fallback to document.body when no match found', () => {
      const result = findConversationRoot();
      expect(result).toBe(document.body);
    });

    it('should prioritize main[class*=conversation] over other selectors', () => {
      const thread = document.createElement('div');
      thread.className = 'thread';
      document.body.appendChild(thread);

      const main = document.createElement('main');
      main.className = 'conversation';
      document.body.appendChild(main);

      const result = findConversationRoot();
      expect(result).toBe(main);
    });
  });

  describe('findScrollableAncestor', () => {
    it('should return null when element has scrollable ancestor with overflow auto', () => {
      const scrollable = document.createElement('div');
      Object.defineProperty(scrollable, 'scrollHeight', { get: () => 1000, configurable: true });
      Object.defineProperty(scrollable, 'clientHeight', { get: () => 500, configurable: true });

      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        overflow: 'auto',
        overflowY: 'auto',
        overflowX: 'hidden',
      } as CSSStyleDeclaration);

      const child = document.createElement('div');
      scrollable.appendChild(child);
      document.body.appendChild(scrollable);

      const result = findScrollableAncestor(child);
      expect(result).toBe(scrollable);
    });

    it('should return null when element has scrollable ancestor with overflow scroll', () => {
      const scrollable = document.createElement('div');
      Object.defineProperty(scrollable, 'scrollHeight', { get: () => 1000, configurable: true });
      Object.defineProperty(scrollable, 'clientHeight', { get: () => 500, configurable: true });

      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        overflow: 'scroll',
        overflowY: 'scroll',
        overflowX: 'hidden',
      } as CSSStyleDeclaration);

      const child = document.createElement('div');
      scrollable.appendChild(child);
      document.body.appendChild(scrollable);

      const result = findScrollableAncestor(child);
      expect(result).toBe(scrollable);
    });

    it('should skip non-scrollable ancestors', () => {
      const nonScrollable = document.createElement('div');
      Object.defineProperty(nonScrollable, 'scrollHeight', { get: () => 100, configurable: true });
      Object.defineProperty(nonScrollable, 'clientHeight', { get: () => 100, configurable: true });

      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        overflow: 'visible',
        overflowY: 'visible',
        overflowX: 'visible',
      } as CSSStyleDeclaration);

      const child = document.createElement('div');
      nonScrollable.appendChild(child);
      document.body.appendChild(nonScrollable);

      const result = findScrollableAncestor(child);
      expect(result).toBe(document.documentElement);
    });

    it('should return document.documentElement when no scrollable ancestor found', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        overflow: 'visible',
        overflowY: 'visible',
        overflowX: 'visible',
      } as CSSStyleDeclaration);

      const result = findScrollableAncestor(el);
      expect(result).toBe(document.documentElement);
    });

    it('should stop at document.body', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        overflow: 'visible',
        overflowY: 'visible',
        overflowX: 'visible',
      } as CSSStyleDeclaration);

      const result = findScrollableAncestor(el);
      expect(result).toBe(document.documentElement);
    });
  });

  describe('buildActiveThread', () => {
    it('should return empty array when not enough candidates', () => {
      vi.mocked(collectCandidates).mockReturnValue({ nodes: [], tier: 'A' });

      const result = buildActiveThread();
      expect(result).toEqual([]);
    });

    it('should build thread with visible nodes', () => {
      const node1 = document.createElement('div');
      node1.dataset.messageAuthorRole = 'user';
      node1.textContent = 'User message';
      document.body.appendChild(node1);

      const node2 = document.createElement('div');
      node2.dataset.messageAuthorRole = 'assistant';
      node2.textContent = 'Assistant message';
      document.body.appendChild(node2);

      // Mock offsetParent for visibility
      Object.defineProperty(node1, 'offsetParent', {
        get: () => document.body,
        configurable: true,
      });
      Object.defineProperty(node2, 'offsetParent', {
        get: () => document.body,
        configurable: true,
      });

      // Mock getClientRects
      vi.spyOn(node1, 'getClientRects').mockReturnValue([
        { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 } as DOMRect,
      ] as DOMRectList);
      vi.spyOn(node2, 'getClientRects').mockReturnValue([
        { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 } as DOMRect,
      ] as DOMRectList);

      // Mock getBoundingClientRect
      vi.spyOn(node1, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      } as DOMRect);
      vi.spyOn(node2, 'getBoundingClientRect').mockReturnValue({
        top: 150,
        left: 0,
        right: 100,
        bottom: 250,
        width: 100,
        height: 100,
        x: 0,
        y: 150,
      } as DOMRect);

      vi.mocked(collectCandidates).mockReturnValue({ nodes: [node1, node2], tier: 'A' });

      const result = buildActiveThread();
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
      expect(result[0].visible).toBe(true);
      expect(result[1].visible).toBe(true);
    });

    it('should filter out invisible nodes', () => {
      const visibleNode = document.createElement('div');
      visibleNode.dataset.messageAuthorRole = 'user';
      document.body.appendChild(visibleNode);

      const hiddenNode = document.createElement('div');
      hiddenNode.dataset.messageAuthorRole = 'assistant';
      hiddenNode.setAttribute('hidden', '');
      document.body.appendChild(hiddenNode);

      // Mock visibility
      Object.defineProperty(visibleNode, 'offsetParent', {
        get: () => document.body,
        configurable: true,
      });
      vi.spyOn(visibleNode, 'getClientRects').mockReturnValue([
        { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 } as DOMRect,
      ] as DOMRectList);
      vi.spyOn(visibleNode, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      } as DOMRect);

      vi.mocked(collectCandidates).mockReturnValue({ nodes: [visibleNode, hiddenNode], tier: 'A' });

      const result = buildActiveThread();
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });

    it('should sort nodes by Y-coordinate', () => {
      const node1 = document.createElement('div');
      const node2 = document.createElement('div');
      const node3 = document.createElement('div');

      document.body.appendChild(node1);
      document.body.appendChild(node2);
      document.body.appendChild(node3);

      // Mock visibility for all nodes
      [node1, node2, node3].forEach(node => {
        Object.defineProperty(node, 'offsetParent', {
          get: () => document.body,
          configurable: true,
        });
        vi.spyOn(node, 'getClientRects').mockReturnValue([
          { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 } as DOMRect,
        ] as DOMRectList);
      });

      // Mock getBoundingClientRect with different Y positions (out of order)
      vi.spyOn(node1, 'getBoundingClientRect').mockReturnValue({
        top: 300,
        left: 0,
        right: 100,
        bottom: 400,
        width: 100,
        height: 100,
        x: 0,
        y: 300,
      } as DOMRect);
      vi.spyOn(node2, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
      } as DOMRect);
      vi.spyOn(node3, 'getBoundingClientRect').mockReturnValue({
        top: 150,
        left: 0,
        right: 100,
        bottom: 250,
        width: 100,
        height: 100,
        x: 0,
        y: 150,
      } as DOMRect);

      vi.mocked(collectCandidates).mockReturnValue({ nodes: [node1, node2, node3], tier: 'A' });

      const result = buildActiveThread();
      expect(result).toHaveLength(3);
      expect(result[0].y).toBe(0);
      expect(result[1].y).toBe(150);
      expect(result[2].y).toBe(300);
    });
  });
});
