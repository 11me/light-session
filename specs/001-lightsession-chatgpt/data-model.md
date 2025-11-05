# Data Model: LightSession for ChatGPT

**Feature**: 001-lightsession-chatgpt
**Date**: 2025-11-05
**Purpose**: Define entities, state machines, validation rules, and relationships for the extension's data layer

## Overview

This document specifies the data structures and state management for LightSession. The extension operates with minimal persistent state (settings only) and transient runtime state (trimmer, observers). All entities are TypeScript interfaces enforced at compile time.

---

## 1. Persistent Entities (browser.storage.local)

### 1.1 LsSettings

**Purpose**: User configuration persisted across browser sessions

**Schema** (from constitution § 4.1):
```typescript
interface LsSettings {
  version: 1;              // Schema version for migrations
  enabled: boolean;        // Toggle trimming on/off
  keep: number;            // Message retention limit (1-100)
  preserveSystem: boolean; // Preserve system/tool messages
  pauseOnScrollUp: boolean;// Pause trimming when scrolled up
  debug: boolean;          // Enable debug logging
}
```

**Defaults**:
```typescript
const DEFAULT_SETTINGS: Readonly<LsSettings> = {
  version: 1,
  enabled: true,
  keep: 10,
  preserveSystem: true,
  pauseOnScrollUp: true,
  debug: false
} as const;
```

**Validation Rules**:
```typescript
function validateSettings(input: Partial<LsSettings>): LsSettings {
  return {
    version: 1, // Always current version
    enabled: input.enabled ?? true,
    keep: Math.max(1, Math.min(100, input.keep ?? 10)), // Clamp [1, 100]
    preserveSystem: input.preserveSystem ?? true,
    pauseOnScrollUp: input.pauseOnScrollUp ?? true,
    debug: input.debug ?? false
  };
}
```

**Storage Key**: `ls_settings` (single key in browser.storage.local)

**Lifecycle**:
- **Creation**: On extension install (defaults applied)
- **Read**: On content script boot, on popup open
- **Update**: On user interaction in popup (partial updates via merge)
- **Delete**: On extension uninstall (automatic by Firefox)

**Relationships**:
- **→ TrimmerState**: `enabled` flag controls trimmer activation
- **→ NodeInfo**: `keep` determines how many NodeInfo objects preserved
- **→ NodeInfo**: `preserveSystem` filters which NodeInfo objects exempt from deletion

---

## 2. Runtime Entities (In-Memory)

### 2.1 NodeInfo

**Purpose**: Represents a candidate conversation message node with metadata for trimming decisions

**Schema** (from constitution § 4.3):
```typescript
interface NodeInfo {
  node: HTMLElement;    // Reference to DOM element
  role: MsgRole;        // Classified message role
  id: string;           // Stable identifier (data-message-id or generated)
  y: number;            // Vertical scroll position (getBoundingClientRect().top)
  visible: boolean;     // Visibility heuristic result
}
```

**Role Enumeration**:
```typescript
type MsgRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown';
```

**ID Generation Strategy**:
```typescript
function getNodeId(el: HTMLElement, index: number): string {
  // Priority 1: data-message-id attribute
  if (el.dataset.messageId) return el.dataset.messageId;

  // Priority 2: Stable hash of position + content prefix
  const contentPrefix = el.textContent?.slice(0, 50) || '';
  return `msg-${index}-${simpleHash(contentPrefix)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
```

**Visibility Rules** (from tz.md § 6.5.6):
```typescript
function isVisible(el: HTMLElement): boolean {
  // Rule 1: offsetParent null = display:none or detached
  if (el.offsetParent === null) return false;

  // Rule 2: No bounding rects = width/height 0
  if (el.getClientRects().length === 0) return false;

  // Rule 3: Hidden ancestor
  if (el.closest('[hidden], [aria-hidden="true"]')) return false;

  return true;
}
```

**Role Detection Heuristics** (from tz.md § 6.5.5):
```typescript
function detectRole(el: HTMLElement): MsgRole {
  // Priority 1: Explicit data attributes
  const author = (
    el.dataset.messageAuthor ||
    el.dataset.role ||
    ''
  ).toLowerCase();

  if (/system/.test(author)) return 'system';
  if (/tool|function|plugin/.test(author)) return 'tool';
  if (/assistant|model|ai/.test(author)) return 'assistant';
  if (/user|you/.test(author)) return 'user';

  // Priority 2: Structural/content-based
  if (el.querySelector('[data-testid*="tool" i], [data-tool-call-id]')) {
    return 'tool';
  }
  if (el.querySelector('[data-testid*="copy" i], [data-testid*="regenerate" i]')) {
    return 'assistant';
  }

  // Priority 3: ARIA roles
  const role = el.getAttribute('role');
  if (role === 'status' || role === 'log' || role === 'alert') {
    return 'system';
  }

  return 'unknown';
}
```

**Lifecycle**:
- **Creation**: By `collectCandidates()` and `buildActiveThread()` on each trim evaluation
- **Lifespan**: Ephemeral (created, used, discarded within single trim cycle)
- **Memory**: ~100-200 bytes per instance, 10-500 instances per cycle

**Relationships**:
- **LsSettings.keep**: Determines how many NodeInfo kept (oldest removed)
- **LsSettings.preserveSystem**: NodeInfo with role='system'|'tool' exempt if true
- **TrimmerState**: Array of NodeInfo drives DELETE state transition

---

### 2.2 TrimmerState

**Purpose**: State machine for trimming lifecycle

**State Enumeration**:
```typescript
type TrimmerStateType = 'IDLE' | 'OBSERVING' | 'PENDING_TRIM' | 'TRIMMING';
```

**State Machine** (from constitution § 6):
```
IDLE ──[boot()]──> OBSERVING
OBSERVING ──[mutation + enabled]──> PENDING_TRIM
PENDING_TRIM ──[debounce complete + preconditions met]──> TRIMMING
TRIMMING ──[batch complete]──> OBSERVING
OBSERVING ──[disabled]──> IDLE
```

**State Object**:
```typescript
interface TrimmerState {
  current: TrimmerStateType;
  observer: MutationObserver | null;
  trimScheduled: boolean;      // Debounce flag
  lastTrimTime: number;        // performance.now() of last trim
  conversationRoot: HTMLElement | null;
  scrollContainer: HTMLElement | null;
  isAtBottom: boolean;         // Scroll position tracking
  settings: LsSettings;        // Cached settings (refreshed on storage change)
}
```

**Initial State**:
```typescript
const INITIAL_STATE: TrimmerState = {
  current: 'IDLE',
  observer: null,
  trimScheduled: false,
  lastTrimTime: 0,
  conversationRoot: null,
  scrollContainer: null,
  isAtBottom: true,
  settings: DEFAULT_SETTINGS
};
```

**State Transition Functions**:
```typescript
// IDLE → OBSERVING
function boot(state: TrimmerState): TrimmerState {
  const root = findConversationRoot();
  if (!root) return state; // Fail-safe: stay IDLE

  const observer = new MutationObserver(onMutation);
  observer.observe(root, { childList: true, subtree: true });

  return {
    ...state,
    current: 'OBSERVING',
    observer,
    conversationRoot: root,
    scrollContainer: findScrollableAncestor(root)
  };
}

// OBSERVING → PENDING_TRIM
function scheduleTrim(state: TrimmerState): TrimmerState {
  if (!state.settings.enabled || state.trimScheduled) return state;

  setTimeout(() => evaluateTrim(state), DEBOUNCE_MS);

  return { ...state, trimScheduled: true };
}

// PENDING_TRIM → TRIMMING (or back to OBSERVING)
function evaluateTrim(state: TrimmerState): TrimmerState {
  // Precondition checks (from constitution § 6)
  if (!state.settings.enabled) return { ...state, current: 'OBSERVING' };
  if (state.settings.pauseOnScrollUp && !state.isAtBottom) {
    return { ...state, current: 'OBSERVING' };
  }
  if (isStreaming(state.conversationRoot)) {
    return { ...state, current: 'OBSERVING' };
  }

  const nodes = buildActiveThread(state.conversationRoot);
  if (nodes.length < 6) { // Fail-safe threshold
    return { ...state, current: 'OBSERVING' };
  }

  // Calculate overflow
  const toKeep = calculateKeepCount(nodes, state.settings);
  const overflow = nodes.length - toKeep;

  if (overflow <= 0) {
    return { ...state, current: 'OBSERVING' };
  }

  // Transition to TRIMMING
  const toRemove = nodes.slice(0, overflow).filter(n =>
    !state.settings.preserveSystem || (n.role !== 'system' && n.role !== 'tool')
  );

  executeTrim(toRemove, state.observer);

  return {
    ...state,
    current: 'OBSERVING',
    trimScheduled: false,
    lastTrimTime: performance.now()
  };
}

// Helper: Calculate keep count with preservation
function calculateKeepCount(nodes: NodeInfo[], settings: LsSettings): number {
  if (!settings.preserveSystem) return settings.keep;

  const systemToolCount = nodes.filter(n =>
    n.role === 'system' || n.role === 'tool'
  ).length;

  return settings.keep + systemToolCount;
}
```

**Lifecycle**:
- **Creation**: On content script load (INITIAL_STATE)
- **Updates**: On mutation, scroll, settings change
- **Destruction**: On page unload or extension disable

---

### 2.3 SelectorTier

**Purpose**: Enumeration and metadata for multi-tier selector strategy

**Tier Definitions** (from research.md § 3):
```typescript
interface SelectorTier {
  name: 'A' | 'B' | 'C';
  description: string;
  selectors: string[];
  minCandidates: number; // Minimum valid results
}

const SELECTOR_TIERS: Readonly<SelectorTier[]> = [
  {
    name: 'A',
    description: 'Current UI (data attributes)',
    selectors: [
      '[data-message-id]',
      'article[data-message-id]',
      '[data-message-author]'
    ],
    minCandidates: 6
  },
  {
    name: 'B',
    description: 'Fallback (test IDs and roles)',
    selectors: [
      '[data-testid*="message" i]',
      'article[role="article"] [data-testid*="content" i]',
      'div[role="article"]'
    ],
    minCandidates: 6
  },
  {
    name: 'C',
    description: 'Defensive (structural + content)',
    selectors: ['article', 'div', 'li'], // + isLikelyMessage filter
    minCandidates: 6
  }
] as const;
```

**Tier Selection Logic**:
```typescript
function collectCandidates(): { nodes: HTMLElement[]; tier: 'A' | 'B' | 'C' | null } {
  for (const tier of SELECTOR_TIERS) {
    const nodes = [...new Set(
      tier.selectors.flatMap(sel =>
        Array.from(document.querySelectorAll<HTMLElement>(sel))
      )
    )];

    const filtered = nodes.filter(isLikelyMessage);

    if (filtered.length >= tier.minCandidates && isSequenceValid(filtered)) {
      if (debugMode) {
        console.log(`LS: Using selector tier ${tier.name} (${filtered.length} candidates)`);
      }
      return { nodes: filtered, tier: tier.name };
    }
  }

  if (debugMode) {
    console.warn('LS: All selector tiers failed, skipping trim');
  }
  return { nodes: [], tier: null };
}
```

---

## 3. Message Protocol Entities

### 3.1 Runtime Messages

**Purpose**: Communication between popup, background, and content scripts

**Message Types** (from constitution § 4.2):
```typescript
// Popup → Background or Content → Background
type GetSettingsMessage = {
  type: 'GET_SETTINGS';
};

type GetSettingsResponse = {
  settings: LsSettings;
};

// Popup → Background
type SetSettingsMessage = {
  type: 'SET_SETTINGS';
  payload: Partial<Omit<LsSettings, 'version'>>;
};

type SetSettingsResponse = {
  ok: true;
};

// Popup ↔ Content (health check)
type PingMessage = {
  type: 'PING';
};

type PongMessage = {
  type: 'PONG';
  timestamp: number;
};

// Union type for all messages
type RuntimeMessage =
  | GetSettingsMessage
  | SetSettingsMessage
  | PingMessage;

type RuntimeResponse =
  | GetSettingsResponse
  | SetSettingsResponse
  | PongMessage;
```

**Handler Pattern** (background script):
```typescript
browser.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender): Promise<RuntimeResponse> | RuntimeResponse => {
    try {
      switch (message.type) {
        case 'GET_SETTINGS':
          return loadSettings(); // Returns Promise<GetSettingsResponse>

        case 'SET_SETTINGS':
          return updateSettings(message.payload).then(() => ({ ok: true }));

        case 'PING':
          return { type: 'PONG', timestamp: Date.now() };

        default:
          throw new Error(`Unknown message type: ${(message as any).type}`);
      }
    } catch (error) {
      console.error('LS: Message handler error:', error);
      throw error; // Propagate to sender
    }
  }
);
```

**Timeout Handling** (from constitution § 4.2):
```typescript
async function sendMessageWithTimeout<T>(
  message: RuntimeMessage,
  timeoutMs = 500
): Promise<T> {
  return Promise.race([
    browser.runtime.sendMessage(message) as Promise<T>,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
    )
  ]);
}
```

---

## 4. Validation & Invariants

### 4.1 Settings Validation

**Invariants**:
1. `keep` ∈ [1, 100] (clamped on read and write)
2. `version` = 1 (current schema)
3. All boolean fields default to `true` except `debug` (defaults to `false`)

**Enforcement**: Validation function applied on every read from storage

### 4.2 NodeInfo Validation

**Invariants**:
1. `y` coordinates monotonically increasing (±4px tolerance)
2. All `visible = true` nodes have `offsetParent !== null`
3. `node` references are live (not detached from DOM)

**Enforcement**: `isSequenceValid()` checks before using NodeInfo array

```typescript
function isSequenceValid(nodes: NodeInfo[]): boolean {
  if (nodes.length < 2) return true;

  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].y < nodes[i - 1].y - 4) { // 4px tolerance
      if (debugMode) {
        console.warn(`LS: Y-coordinate non-monotonic at index ${i}`);
      }
      return false;
    }
  }

  return true;
}
```

### 4.3 State Machine Invariants

**Invariants**:
1. `observer !== null` ⟺ `current !== 'IDLE'`
2. `trimScheduled = true` ⟹ `current ∈ {'OBSERVING', 'PENDING_TRIM'}`
3. `conversationRoot !== null` ⟹ `current !== 'IDLE'`

**Enforcement**: Type guards and assertions in state transition functions

---

## 5. Relationships & Dependencies

### Entity Relationship Diagram

```
┌─────────────────┐
│   LsSettings    │ (Persistent)
│  (storage.local)│
└────────┬────────┘
         │ 1
         │ configures
         │
         ▼ *
┌─────────────────┐      creates      ┌──────────────┐
│ TrimmerState    │ ───────────────▶  │  NodeInfo[]  │
│  (runtime)      │  evaluates trim   │  (transient) │
└────────┬────────┘                   └──────────────┘
         │ 1
         │ observes
         │
         ▼ 1
┌─────────────────┐
│ HTMLElement     │ (ChatGPT DOM)
│ (conversation)  │
└─────────────────┘
```

**Dependency Flow**:
1. LsSettings → TrimmerState: Settings drive all trimming behavior
2. TrimmerState → NodeInfo[]: State machine creates transient node metadata
3. NodeInfo[] → HTMLElement: Node removal decisions applied to DOM
4. HTMLElement changes → MutationObserver → TrimmerState: Mutations trigger re-evaluation

---

## 6. Memory & Performance Estimates

| Entity | Count | Size | Lifecycle | Total Memory |
|--------|-------|------|-----------|--------------|
| LsSettings | 1 | ~200 bytes | Persistent | 200 bytes |
| TrimmerState | 1 | ~500 bytes | Session | 500 bytes |
| NodeInfo | 10-500 | ~150 bytes | Ephemeral (ms) | 1.5-75 KB |
| MutationObserver | 1 | ~1 KB | Session | 1 KB |
| **Total** | - | - | - | **~2-77 KB** |

**Notes**:
- NodeInfo arrays created/destroyed on each trim evaluation (~1-5 times per conversation growth)
- Peak memory during 500-message conversation: ~77KB (negligible)
- Steady-state memory: ~2KB (settings + state)

---

## 7. Future Schema Migrations

### Version 2 Example (Hypothetical)

```typescript
interface LsSettings_v2 extends LsSettings_v1 {
  version: 2;
  autoAdjust: boolean; // New field: auto-adjust N based on memory
}

function migrateSettings(stored: any): LsSettings {
  if (stored.version === 1) {
    return {
      ...stored,
      version: 2,
      autoAdjust: false // Default for new field
    };
  }
  // ... handle older versions
}
```

---

## Summary

**Persistent State**: 1 entity (LsSettings, <1KB)
**Runtime State**: 2 entities (TrimmerState, NodeInfo[], <80KB peak)
**Message Protocol**: 3 message types, 3 response types
**Validation**: 3 sets of invariants (Settings, NodeInfo, State Machine)
**Total Memory Footprint**: ~2-77KB (negligible for browser extension)

**Next Steps**: Proceed to contracts/ for TypeScript interface definitions and quickstart.md for development setup.
