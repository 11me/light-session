/**
 * LightSession for ChatGPT - Trimming Logic
 *
 * Core algorithm for trimming ChatGPT conversation data.
 * Extracted for testability and reuse.
 */

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  author?: {
    role?: string;
  };
}

/**
 * Current conversation responses use a flat, chronological messages array
 * rather than the legacy mapping tree. Keep this deliberately permissive:
 * ChatGPT adds message metadata frequently, and trimming must preserve it.
 */
export interface ConversationMessage extends ChatMessage {
  id?: string;
  [key: string]: unknown;
}

export interface ConversationPageInfo {
  start_cursor?: string;
  end_cursor?: string;
  has_previous_page?: boolean;
  [key: string]: unknown;
}

export interface ChatNode {
  parent: string | null;
  children?: string[];
  message?: ChatMessage;
}

export interface ChatMapping {
  [nodeId: string]: ChatNode;
}

export interface ConversationData {
  mapping?: ChatMapping;
  current_node?: string;
  root?: string;
  messages?: ConversationMessage[];
  page_info?: ConversationPageInfo;
}

export interface TrimResult {
  mapping: ChatMapping;
  current_node: string;
  root: string;
  keptCount: number;
  totalCount: number;
  visibleKept: number;
  visibleTotal: number;
}

export interface MessagesTrimResult {
  messages: ConversationMessage[];
  keptCount: number;
  totalCount: number;
  visibleKept: number;
  visibleTotal: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Roles that are NOT visible to users (hidden/internal).
 * Everything else (user, assistant, etc.) is considered visible.
 */
export const HIDDEN_ROLES = new Set([
  'system', // System prompts
  'tool', // Tool/function calls
  'thinking', // Extended Thinking internal nodes
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a node is a visible message.
 * A node is visible if it has a message with an author role that is NOT in HIDDEN_ROLES.
 * Nodes without messages (like root nodes) are not visible.
 */
export function isVisibleMessage(node: ChatNode): boolean {
  return isVisibleRole(node.message?.author?.role);
}

/**
 * Check whether an item in the modern flat messages array is visible.
 */
export function isVisibleConversationMessage(message: ConversationMessage): boolean {
  return isVisibleRole(message.author?.role);
}

function isVisibleRole(role: string | undefined): boolean {
  // Must have a role to be considered a message.
  return !!role && !HIDDEN_ROLES.has(role);
}

// ============================================================================
// Trimming Algorithm
// ============================================================================

/**
 * Trim conversation mapping to keep only the last N messages in the thread.
 *
 * Algorithm:
 * 1. Start from current_node, walk up via parent links to build the full path
 * 2. Reverse to get chronological order (oldest first)
 * 3. Count TURNS (role transitions), not individual nodes
 * 4. Keep only the last `limit` turns
 * 5. Rebuild mapping with only kept nodes, fixing parent/children links
 *
 * @param data - The conversation data containing mapping and current_node
 * @param limit - Number of turns (role transitions) to keep
 * @returns TrimResult with new mapping, or null if trimming not possible
 */
export function trimMapping(
  data: ConversationData,
  limit: number
): TrimResult | null {
  const mapping = data.mapping;
  const currentNode = data.current_node;

  if (!mapping || !currentNode || !mapping[currentNode]) {
    return null;
  }

  // Build path from current_node to root by following parent links
  const path: string[] = [];
  let cursor: string | null = currentNode;
  const visited = new Set<string>();

  while (cursor) {
    const node: ChatNode | undefined = mapping[cursor];
    if (!node || visited.has(cursor)) {
      break;
    }
    visited.add(cursor);
    path.push(cursor);
    cursor = node.parent ?? null;
  }

  // Reverse to chronological order (oldest first)
  path.reverse();

  const totalCount = path.length;
  const effectiveLimit = Math.max(1, limit);

  // Count total TURNS (role transitions) and collect role statistics
  let visibleTotal = 0;
  let lastVisibleRole: string | null = null;
  for (const nodeId of path) {
    const node = mapping[nodeId];
    if (node && isVisibleMessage(node)) {
      const role = node.message?.author?.role ?? '';
      // Count turns, not individual nodes
      if (role !== lastVisibleRole) {
        visibleTotal++;
        lastVisibleRole = role;
      }
    }
  }

  // Find cut point by counting TURNS (role transitions), not individual nodes
  // A turn is a contiguous sequence of messages from the same role
  // This matches how ChatGPT renders messages (multiple nodes = 1 bubble)
  //
  // We iterate backwards (newest to oldest) and count turns on role changes.
  // When we've counted N turns and see a NEW turn (N+1), we break.
  // cutIndex = i+1 ensures we keep all nodes of the Nth turn.
  let turnCount = 0;
  let cutIndex = 0;
  let lastRole: string | null = null;

  for (let i = path.length - 1; i >= 0; i--) {
    const nodeId = path[i];
    if (!nodeId) continue;

    const node = mapping[nodeId];
    if (node && isVisibleMessage(node)) {
      const role = node.message?.author?.role ?? '';
      // Count turn when role changes (or first visible message)
      if (role !== lastRole) {
        turnCount++;
        lastRole = role;
      }
      // Break when we've EXCEEDED the limit (entering turn N+1)
      // This ensures all nodes of turn N are included
      if (turnCount > effectiveLimit) {
        cutIndex = i + 1; // Start from the first node of the Nth turn
        break;
      }
    }
  }

  const keptRaw = path.slice(cutIndex);
  const keptVisible = keptRaw.filter((id) => {
    const node = mapping[id];
    return node && isVisibleMessage(node);
  });

  if (keptVisible.length === 0) {
    return null;
  }

  // Preserve original root node - ChatGPT needs this "(no role)" node as tree anchor
  const originalRootId = path[0];
  const originalRootNode = originalRootId ? mapping[originalRootId] : null;
  const hasOriginalRoot = originalRootId && originalRootNode && !isVisibleMessage(originalRootNode);

  const keptPath =
    hasOriginalRoot && originalRootId && keptRaw[0] === originalRootId
      ? keptRaw.slice(1)
      : keptRaw;

  // Build new mapping with kept suffix + original root
  const newMapping: ChatMapping = {};
  let turnsKept = 0;
  let prevRole: string | null = null;

  // Add original root node first (the "(no role)" anchor node)
  if (hasOriginalRoot) {
    newMapping[originalRootId] = {
      ...originalRootNode,
      parent: null,
      children: keptPath[0] ? [keptPath[0]] : [],
    };
  }

  // Add all nodes in the kept suffix, including hidden nodes that belong
  // to the visible turns we keep. ChatGPT can depend on these for rendering.
  for (let i = 0; i < keptPath.length; i++) {
    const id = keptPath[i];
    if (!id) continue;

    // First kept node's parent is originalRoot (if exists), otherwise null
    const prevId =
      i === 0 ? (hasOriginalRoot ? originalRootId : null) : keptPath[i - 1];
    const nextId = keptPath[i + 1] ?? null;
    const originalNode = mapping[id];

    if (originalNode) {
      newMapping[id] = {
        ...originalNode,
        parent: prevId ?? null,
        children: nextId ? [nextId] : [],
      };
      // Count turns (role transitions) for accurate display
      const role = originalNode.message?.author?.role ?? '';
      if (role !== prevRole && isVisibleMessage(originalNode)) {
        turnsKept++;
        prevRole = role;
      }
    }
  }

  const visibleKept = turnsKept;

  // Use original root if available, otherwise first kept node
  const newRoot = hasOriginalRoot ? originalRootId : keptPath[0];
  const newCurrentNode = keptPath[keptPath.length - 1];

  // These should always be defined since kept.length > 0, but TypeScript needs assurance
  if (!newRoot || !newCurrentNode) {
    return null;
  }

  return {
    mapping: newMapping,
    current_node: newCurrentNode,
    root: newRoot,
    keptCount: Object.keys(newMapping).length,
    totalCount,
    visibleKept,
    visibleTotal,
  };
}

/**
 * Trim a modern flat conversation response to its last N visible turns.
 *
 * The current /backend-api/conversations/<id> response contains a
 * chronological messages array instead of the legacy mapping tree. We retain
 * the same role-transition semantics as trimMapping() and preserve hidden
 * records that occur within the retained suffix (for example tool output
 * between a user prompt and its final assistant answer).
 */
export function trimMessages(data: ConversationData, limit: number): MessagesTrimResult | null {
  const messages = data.messages;
  if (!Array.isArray(messages)) {
    return null;
  }

  const effectiveLimit = Math.max(1, limit);
  let visibleTotal = 0;
  let lastVisibleRole: string | null = null;

  for (const message of messages) {
    if (!isVisibleConversationMessage(message)) {
      continue;
    }

    const role = message.author?.role ?? '';
    if (role !== lastVisibleRole) {
      visibleTotal++;
      lastVisibleRole = role;
    }
  }

  if (visibleTotal === 0) {
    return null;
  }

  let turnCount = 0;
  let cutIndex = 0;
  let lastRole: string | null = null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || !isVisibleConversationMessage(message)) {
      continue;
    }

    const role = message.author?.role ?? '';
    if (role !== lastRole) {
      turnCount++;
      lastRole = role;
    }

    if (turnCount > effectiveLimit) {
      cutIndex = i + 1;
      break;
    }
  }

  const keptMessages = messages.slice(cutIndex);
  let visibleKept = 0;
  let lastKeptRole: string | null = null;

  for (const message of keptMessages) {
    if (!isVisibleConversationMessage(message)) {
      continue;
    }

    const role = message.author?.role ?? '';
    if (role !== lastKeptRole) {
      visibleKept++;
      lastKeptRole = role;
    }
  }

  return {
    messages: keptMessages,
    keptCount: keptMessages.length,
    totalCount: messages.length,
    visibleKept,
    visibleTotal,
  };
}
