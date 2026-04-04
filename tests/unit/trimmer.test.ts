/**
 * Tests for trimMapping() algorithm
 *
 * Tests the core trimming logic that keeps the last N turns of a conversation.
 * A "turn" is a role transition (user → assistant or assistant → user).
 */

import { describe, it, expect } from 'vitest';
import {
  trimMapping,
  isVisibleMessage,
  HIDDEN_ROLES,
  type ChatNode,
  type ChatMapping,
  type ConversationData,
} from '../../extension/src/shared/trimmer';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a simple chat node
 */
function createNode(
  parent: string | null,
  role?: string,
  children?: string[]
): ChatNode {
  const node: ChatNode = { parent, children };
  if (role) {
    node.message = { author: { role } };
  }
  return node;
}

/**
 * Build a linear conversation path
 * Returns { mapping, current_node } ready for trimMapping()
 */
function buildConversation(
  roles: (string | null)[]
): { mapping: ChatMapping; current_node: string; nodes: string[] } {
  const mapping: ChatMapping = {};
  const nodes: string[] = [];

  for (let i = 0; i < roles.length; i++) {
    const id = `node-${i}`;
    const role = roles[i];
    const parent = i === 0 ? null : `node-${i - 1}`;
    const children = i === roles.length - 1 ? [] : [`node-${i + 1}`];

    mapping[id] = createNode(parent, role ?? undefined, children);
    nodes.push(id);
  }

  return {
    mapping,
    current_node: nodes[nodes.length - 1] ?? 'node-0',
    nodes,
  };
}

// ============================================================================
// isVisibleMessage() Tests
// ============================================================================

describe('isVisibleMessage', () => {
  it('returns true for user role', () => {
    const node = createNode(null, 'user');
    expect(isVisibleMessage(node)).toBe(true);
  });

  it('returns true for assistant role', () => {
    const node = createNode(null, 'assistant');
    expect(isVisibleMessage(node)).toBe(true);
  });

  it('returns false for system role', () => {
    const node = createNode(null, 'system');
    expect(isVisibleMessage(node)).toBe(false);
  });

  it('returns false for tool role', () => {
    const node = createNode(null, 'tool');
    expect(isVisibleMessage(node)).toBe(false);
  });

  it('returns false for thinking role', () => {
    const node = createNode(null, 'thinking');
    expect(isVisibleMessage(node)).toBe(false);
  });

  it('returns false for node without message', () => {
    const node: ChatNode = { parent: null };
    expect(isVisibleMessage(node)).toBe(false);
  });

  it('returns false for node without role', () => {
    const node: ChatNode = { parent: null, message: {} };
    expect(isVisibleMessage(node)).toBe(false);
  });

  it('returns false for node with undefined role', () => {
    const node: ChatNode = { parent: null, message: { author: {} } };
    expect(isVisibleMessage(node)).toBe(false);
  });
});

describe('HIDDEN_ROLES', () => {
  it('contains system, tool, and thinking', () => {
    expect(HIDDEN_ROLES.has('system')).toBe(true);
    expect(HIDDEN_ROLES.has('tool')).toBe(true);
    expect(HIDDEN_ROLES.has('thinking')).toBe(true);
  });

  it('does not contain user or assistant', () => {
    expect(HIDDEN_ROLES.has('user')).toBe(false);
    expect(HIDDEN_ROLES.has('assistant')).toBe(false);
  });
});

// ============================================================================
// trimMapping() Tests - Basic Scenarios
// ============================================================================

describe('trimMapping - basic scenarios', () => {
  it('returns null for missing mapping', () => {
    const data: ConversationData = { current_node: 'node-0' };
    expect(trimMapping(data, 2)).toBeNull();
  });

  it('returns null for missing current_node', () => {
    const { mapping } = buildConversation(['user', 'assistant']);
    const data: ConversationData = { mapping };
    expect(trimMapping(data, 2)).toBeNull();
  });

  it('returns null for current_node not in mapping', () => {
    const { mapping } = buildConversation(['user', 'assistant']);
    const data: ConversationData = { mapping, current_node: 'nonexistent' };
    expect(trimMapping(data, 2)).toBeNull();
  });

  it('keeps all messages when under limit', () => {
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 10);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(2);
    expect(result!.visibleTotal).toBe(2);
  });

  it('trims messages when over limit', () => {
    // 4 turns: [user, assistant, user, assistant]
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 2);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(2); // Keep last 2 turns
    expect(result!.visibleTotal).toBe(4);
  });
});

// ============================================================================
// trimMapping() Tests - Turn Counting
// ============================================================================

describe('trimMapping - turn counting', () => {
  it('counts consecutive same-role messages as one turn', () => {
    // This is [user, assistant, assistant, assistant, user]
    // = 3 turns: user(1), assistant(3 nodes), user(1)
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
      'assistant',
      'assistant',
      'user',
    ]);
    const result = trimMapping({ mapping, current_node }, 2);

    expect(result).not.toBeNull();
    // Keep last 2 turns: [assistant(3), user(1)]
    expect(result!.visibleKept).toBe(2);
    expect(result!.visibleTotal).toBe(3); // 3 turns total
  });

  it('handles alternating roles correctly', () => {
    // 6 turns: [U, A, U, A, U, A]
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 3);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(3); // Last 3 turns
    expect(result!.visibleTotal).toBe(6);
  });
});

// ============================================================================
// trimMapping() Tests - Hidden Roles
// ============================================================================

describe('trimMapping - hidden roles', () => {
  it('excludes system messages from visible count', () => {
    // [system, user, assistant] = 2 visible turns
    const { mapping, current_node } = buildConversation([
      'system',
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 10);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(2);
    expect(result!.visibleTotal).toBe(2);
  });

  it('excludes tool messages from visible count', () => {
    // [user, assistant, tool, assistant] = 2 visible turns (tool doesn't count)
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
      'tool',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 10);

    expect(result).not.toBeNull();
    // user(1) + assistant(2 nodes) = 2 turns
    expect(result!.visibleKept).toBe(2);
    expect(result!.visibleTotal).toBe(2);
  });

  it('excludes thinking messages from visible count', () => {
    // [user, thinking, assistant] = 2 visible turns
    const { mapping, current_node } = buildConversation([
      'user',
      'thinking',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 10);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(2);
    expect(result!.visibleTotal).toBe(2);
  });

  it('handles complex mixed roles', () => {
    // Real-world pattern: [system, user, thinking, tool, assistant]
    // Visible: user + assistant = 2 turns
    const { mapping, current_node } = buildConversation([
      'system',
      'user',
      'thinking',
      'tool',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 10);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(2);
    expect(result!.visibleTotal).toBe(2);
  });

  it('preserves hidden nodes that belong to the kept suffix when trimming', () => {
    const { mapping, current_node } = buildConversation([
      null,
      'user',
      'thinking',
      'tool',
      'assistant',
      'user',
      'thinking',
      'tool',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 2);

    expect(result).not.toBeNull();
    expect(result!.mapping['node-5']).toBeDefined();
    expect(result!.mapping['node-6']).toBeDefined();
    expect(result!.mapping['node-7']).toBeDefined();
    expect(result!.mapping['node-8']).toBeDefined();
    expect(result!.mapping['node-0']?.children).toEqual(['node-5']);
    expect(result!.mapping['node-5']?.children).toEqual(['node-6']);
    expect(result!.mapping['node-6']?.children).toEqual(['node-7']);
    expect(result!.mapping['node-7']?.children).toEqual(['node-8']);
  });

  it('keeps a hidden first node in the suffix as the root child when trimming to one visible turn', () => {
    const { mapping, current_node } = buildConversation([
      null,
      'user',
      'assistant',
      'user',
      'thinking',
      'tool',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 1);

    expect(result).not.toBeNull();
    expect(result!.root).toBe('node-0');
    expect(result!.mapping['node-0']?.children).toEqual(['node-4']);
    expect(result!.mapping['node-4']?.message?.author?.role).toBe('thinking');
    expect(result!.mapping['node-5']?.message?.author?.role).toBe('tool');
    expect(result!.current_node).toBe('node-6');
    expect(result!.visibleKept).toBe(1);
  });
});

// ============================================================================
// trimMapping() Tests - Root Node Preservation
// ============================================================================

describe('trimMapping - root node preservation', () => {
  it('preserves root node without role as anchor', () => {
    // ChatGPT conversations often start with a "(no role)" root node
    const { mapping, current_node } = buildConversation([
      null, // Root node without role
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 2);

    expect(result).not.toBeNull();
    // Root should be preserved
    expect(result!.root).toBe('node-0');
    // But it doesn't count as visible
    expect(result!.visibleKept).toBe(2);
  });

  it('does not force-preserve visible first node as root anchor when trimming', () => {
    // When conversation starts with a visible user message (no rootless anchor),
    // the first node should NOT be duplicated as an anchor if it's trimmed away.
    // [user, assistant, user, assistant] with limit=2 should trim the first 2 turns.
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 2);

    expect(result).not.toBeNull();
    // First node (user) should be trimmed, not force-preserved as root
    expect(result!.mapping['node-0']).toBeUndefined();
    // Root should be the first kept visible node, not node-0
    expect(result!.root).toBe('node-2');
    expect(result!.visibleKept).toBe(2);
  });
});

// ============================================================================
// trimMapping() Tests - Edge Cases
// ============================================================================

describe('trimMapping - edge cases', () => {
  it('handles limit of 1', () => {
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 1);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(1); // Only last turn
  });

  it('handles very large limit', () => {
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 1000);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(2);
  });

  it('handles limit of 0 (treated as 1)', () => {
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 0);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(1); // Minimum 1
  });

  it('handles negative limit (treated as 1)', () => {
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, -5);

    expect(result).not.toBeNull();
    expect(result!.visibleKept).toBe(1); // Minimum 1
  });

  it('protects against circular references', () => {
    const mapping: ChatMapping = {
      'node-a': { parent: 'node-b', message: { author: { role: 'user' } } },
      'node-b': { parent: 'node-a', message: { author: { role: 'assistant' } } }, // Circular!
    };
    const data: ConversationData = { mapping, current_node: 'node-a' };

    // Should not infinite loop
    const result = trimMapping(data, 10);
    expect(result).not.toBeNull();
  });

  it('returns correct current_node after trim', () => {
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 2);

    expect(result).not.toBeNull();
    expect(result!.current_node).toBe('node-3'); // Last node
  });
});

// ============================================================================
// trimMapping() Tests - Mapping Structure
// ============================================================================

describe('trimMapping - mapping structure', () => {
  it('rebuilds parent/children links correctly', () => {
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    const result = trimMapping({ mapping, current_node }, 2);

    expect(result).not.toBeNull();
    const newMapping = result!.mapping;

    // Check links are valid
    for (const [id, node] of Object.entries(newMapping)) {
      // Parent should exist in mapping (or be null for root)
      if (node.parent !== null) {
        expect(newMapping[node.parent]).toBeDefined();
      }
      // Children should exist in mapping
      for (const childId of node.children ?? []) {
        expect(newMapping[childId]).toBeDefined();
      }
    }
  });

  it('preserves message content in kept nodes', () => {
    const { mapping, current_node } = buildConversation([
      'user',
      'assistant',
    ]);
    // Add custom content
    mapping['node-0']!.message = { author: { role: 'user' } };
    mapping['node-1']!.message = { author: { role: 'assistant' } };

    const result = trimMapping({ mapping, current_node }, 10);

    expect(result).not.toBeNull();
    expect(result!.mapping['node-0']?.message?.author?.role).toBe('user');
    expect(result!.mapping['node-1']?.message?.author?.role).toBe('assistant');
  });
});
