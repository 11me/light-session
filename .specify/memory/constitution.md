<!--
Sync Impact Report:
- Version: Initial → 1.0.0
- Rationale: Initial constitution creation for LightSession for ChatGPT (Firefox extension)
- Modified principles: N/A (initial creation)
- Added sections: All sections (15 total + governance)
- Removed sections: None
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md - Constitution Check section exists, ready for use
  ✅ .specify/templates/spec-template.md - Requirements alignment compatible
  ✅ .specify/templates/tasks-template.md - Task categorization supports principle-driven tasks
- Follow-up TODOs: None
-->

# LightSession for ChatGPT (Firefox) Constitution

## 0) Purpose

This constitution defines principles, constraints, and quality standards for the agent-implementer building the Firefox extension "LightSession for ChatGPT". It covers objectives, prohibitions, interface contracts, DOM heuristics, and acceptance criteria. Used in conjunction with the Technical Specification (separate document).

## Core Principles

### I. Privacy-First, Local Operation (MUST)

**Rule**: No network requests, telemetry, or remote runtime dependencies.

**Rationale**: User privacy is paramount. All processing occurs locally within the browser extension. No chat content, history, or user data leaves the device. This principle is non-negotiable and enforced at code review.

**Verification**: Network monitor during testing must show zero outbound requests from extension. Static analysis must confirm no fetch/XHR/WebSocket API usage.

---

### II. Fail-Safe Operation (MUST)

**Rule**: When in doubt, do not delete nodes or modify DOM. Errors must not break the page.

**Rationale**: Extension stability cannot compromise ChatGPT functionality. Conservative behavior protects user experience. All operations must be reversible and non-destructive.

**Implementation**: Try-catch blocks on all DOM operations. Logging errors without throwing. Trimming cancellation on any uncertainty (e.g., < 6 valid nodes, Y-coordinate non-monotonicity).

---

### III. Non-Intrusive Scope (MUST)

**Rule**: Extension operates exclusively on ChatGPT domains: `chat.openai.com`, `chatgpt.com`.

**Rationale**: Minimize attack surface and respect user browsing privacy. No other sites monitored or modified.

**Verification**: `host_permissions` in manifest limited to specified domains only. Content scripts match patterns strictly enforced.

---

### IV. Reversibility (MUST)

**Rule**: Deletions affect DOM only. Page reload restores full history.

**Rationale**: Users maintain control. No permanent data loss. Session management remains ChatGPT's responsibility.

**Implementation**: DOM nodes removed (not sent to backend deletion). Comment markers (`ls-removed`) for debugging. No localStorage/sessionStorage manipulation of chat data.

---

### V. Performance Budget (MUST)

**Rule**: Trimming executes in batches without freezing UI. Single batch ≤ 16ms main thread blocking.

**Rationale**: Extension must not degrade ChatGPT responsiveness. 60fps target maintained during operations.

**Implementation**: `requestIdleCallback` for large batches (5-10 nodes per chunk). Debouncing MutationObserver events (50-100ms). Performance profiling required during acceptance testing.

---

### VI. User Control (MUST)

**Rule**: Popup provides toggle (ON/OFF), configurable limit N (1-100), "Pause when scrolled up", "Preserve system/tool" options.

**Rationale**: Users have different workflows and preferences. Extension adapts to user needs, not vice versa.

**Implementation**: Settings stored in `storage.local` with schema enforcement. Defaults: enabled=true, keep=10, preserveSystem=true, pauseOnScrollUp=true, debug=false. All UI controls keyboard accessible.

---

### VII. Transparency (MUST)

**Rule**: Optional debug mode logs operations to console. UI operates without excessive permissions.

**Rationale**: Developers and advanced users can troubleshoot. Minimal permissions build trust.

**Implementation**: Prefix `LS:` for all logs. Debug logs gated by `settings.debug` flag. Only `storage` permission requested; no tabs, history, cookies, or webRequest.

---

## Prohibitions (MUST NOT)

### Network & Privacy

- **No network modification**: Do not intercept, modify, or initiate HTTP requests
- **No data exfiltration**: Do not save, transmit, or log chat history or content
- **No telemetry**: Do not collect usage statistics or analytics

### Code Injection & Security

- **No third-party scripts**: Do not load external dependencies at runtime
- **No unsafe execution**: Do not use `eval`, `Function()`, or `innerHTML` with untrusted strings
- **No CSP violations**: Do not add `unsafe-eval` or weaken default extension CSP

### Scope Creep

- **No other sites**: Do not process domains beyond `chat.openai.com`, `chatgpt.com`
- **No ads/monetization**: Do not inject advertisements or tracking pixels

---

## Platform Constraints: Firefox MV3

### Manifest Requirements

- **manifest_version**: 3
- **background**: Use `background.scripts` (not `service_worker` - Firefox specific)
- **permissions**: `["storage"]` only
- **host_permissions**: Limited to ChatGPT domains
- **browser_specific_settings.gecko.id**: Mandatory for Firefox AMO

### Browser Compatibility

- **Target**: Firefox ≥ 115 (Windows/macOS/Linux)
- **CSS limitations**: Do not use `:has()` pseudo-class (insufficient support on target versions)
- **API usage**: Use `browser.*` namespace (Firefox standard), with `chrome.*` shims if needed for compatibility

---

## Interface Contracts

### Storage Schema

```typescript
// storage.local key: 'ls_settings'
interface LsSettings {
  enabled: boolean;        // default: true
  keep: number;            // 1..100, default: 10
  preserveSystem: boolean; // default: true
  pauseOnScrollUp: boolean;// default: true
  debug: boolean;          // default: false
}
```

**Constraint**: Only this key namespace used. No other storage writes.

---

### Message Protocol

**Between popup ↔ background ↔ content scripts** (via `runtime.sendMessage`):

- `GET_SETTINGS` → `{ settings: LsSettings }`
- `SET_SETTINGS` (partial update) → `{ ok: true }`
- `PING` / `PONG` for health-check (popup ↔ content)

**Error handling**: Timeout after 500ms, fallback to default settings.

---

### Content Script Internal API

```typescript
boot(): void              // Initialize observers and state
shutdown(): void          // Unsubscribe, cleanup
collectCandidates(): HTMLElement[]  // Apply heuristics (see §5)
buildActiveThread(): NodeInfo[]     // role, id, y, visible
trimOnce(nodes: NodeInfo[]): void   // Execute deletion logic
```

**NodeInfo interface**:

```typescript
interface NodeInfo {
  node: HTMLElement;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'unknown';
  id: string;         // Stable identifier
  y: number;          // Scroll position
  visible: boolean;   // In viewport or recently rendered
}
```

---

## DOM Heuristics (Mandatory)

### Source of Truth

**Section 6.5 "Node Identification and Selectors"** of the Technical Specification is authoritative. This section summarizes principles; refer to spec for exact selectors.

### Safety Gates

**Do NOT trim if**:

- `collectCandidates()` returns < 6 valid nodes
- Y-coordinate ordering non-monotonic (suggests layout thrash)
- Streaming indicator present (defer 300-500ms, recheck)
- User scrolled above last message (if `pauseOnScrollUp` enabled)

### Whitelists (Never Delete)

- Composer/input areas
- Sidebar/header/navigation
- System/tool nodes (when `preserveSystem: true`)
- Large media/tables/code blocks with unknown role (conservative fallback)

### Selector Strategy

**Multi-tier fallback**: Try selector set A (current UI), then B (recent historical), then C (defensive). On failure, abort trimming and log warning in debug mode.

---

## Trimming Algorithm (State Machine)

### States

`idle` → `observing` → `pending_trim` → `trimming` → `idle`

### Execution Flow

1. **MutationObserver** on root container
   - Batch events (debounce 50-100ms)
   - Accumulate changes without immediate action

2. **Precondition checks** (if all true, proceed):
   - `enabled === true`
   - `isAtBottom === true` (user at scroll bottom)
   - `!isStreaming` (no generation in progress)

3. **Build active thread**:
   - `active = buildActiveThread()` (visible nodes in main scroll container)
   - Calculate `toKeep = settings.keep + (preserveSystem ? systemCount : 0)`
   - `overflow = active.length - toKeep`

4. **Execute deletion**:
   - Remove earliest `overflow` nodes
   - Replace with `Comment('ls-removed')` marker
   - Actual node removal in idle callback (avoid sync layout thrash)

5. **Resume observation**: Return to `observing` state

### Streaming Detection

- Look for typing indicators, "Stop generating" button, or incomplete message markers
- On detection: defer trimming 300-500ms, then recheck
- Maximum 3 rechecks before aborting (prevents infinite deferral)

---

## Quality & Performance Budgets

### Main Thread Blocking

- **Single batch**: ≤ 16ms
- **Large batches**: Chunk into 5-10 nodes per `requestIdleCallback` slice

### Memory Impact

- **Thread with 100+ messages**: ≥ 80% of old message DOM nodes removed
- **Target**: 25-50% heap reduction (validated via Firefox DevTools memory snapshot)

### Stability

- **Zero uncaught errors** in console during normal operation
- **No flicker** during streaming responses
- **No scroll jump** after trimming (scroll position maintained)

---

## Logging & Debug

### Prefix

All messages: `LS: <message>`

### Activation

Only if `settings.debug === true`

### Content

- Selected selector set (A/B/C)
- Message count before/after trimming
- Reasons for trimming refusal (e.g., "too few candidates", "user scrolled up")
- Performance timing (optional, if debug=true and verbose)

---

## Security

### Content Security Policy

- **Default extension CSP**: Maintained without relaxation
- **No `unsafe-eval`**: No dynamic code generation

### XSS Prevention

- **No `innerHTML` with untrusted data**: Use `textContent` or DOM APIs
- **No user content injection**: Extension does not parse or execute chat messages

### Privacy Boundary

- **Content script isolation**: Does not read message text for processing
- **No external communication**: All logic local to browser

---

## UX & Accessibility

### Keyboard Navigation

- All popup controls reachable via Tab
- Enter/Space activate buttons/toggles

### ARIA Attributes

- `aria-pressed` for toggle button
- `aria-checked` for checkboxes
- `aria-label` on all controls

### Visual Feedback

- ON/OFF state visible without interaction
- Current limit N displayed prominently
- No UI flashing during streaming

---

## Acceptance Test Plan (Minimum)

### Long Thread Test

- **Setup**: Thread with 100+ messages
- **Verify**: DOM contains ≤ N last messages of active branch
- **Verify**: UI remains responsive (no frame drops)

### Scroll Pause Test

- **Setup**: Scroll up away from bottom
- **Verify**: Trimming paused (check via debug logs or DOM observation)
- **Action**: Scroll to bottom
- **Verify**: Trimming resumes

### System/Tool Preservation Test

- **Setup**: Thread with system/tool messages, `preserveSystem: true`
- **Verify**: System/tool nodes retained beyond N limit

### Streaming Test

- **Setup**: Generate long response
- **Verify**: Trimming does not activate mid-stream
- **Verify**: Trimming executes after generation completes

### Reload Reversibility Test

- **Setup**: Trim messages from long thread
- **Action**: Reload page (F5)
- **Verify**: Full history restored, extension does not break layout

### Extension Compatibility Test

- **Setup**: Install popular ChatGPT extensions (e.g., ChatGPT Writer, Promptheus)
- **Verify**: No conflicts (observers, styles, functionality)

---

## Red Team Scenarios (Must Be Safe)

### ChatGPT UI Change

- **Scenario**: OpenAI modifies class names or structure
- **Response**: Selector fallback A→B→C. On failure, abort trimming and log warning. Do not crash or corrupt DOM.

### Large Media Messages

- **Scenario**: Message with many images/tables/code blocks
- **Response**: Conservative no-delete policy when role unknown. Preserve potentially valuable content.

### Rapid Thread Growth

- **Scenario**: User spams regenerate/continue buttons
- **Response**: Batch observer events. Do not create observer "storm". Maintain debouncing.

### Multiple Tabs

- **Scenario**: User opens multiple ChatGPT tabs
- **Response**: Independent state per tab. No cross-tab interference. Content scripts isolated.

---

## Versioning & Release

### Semantic Versioning (SemVer)

- **Format**: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes (e.g., settings schema incompatible)
- **MINOR**: New features (e.g., new option added)
- **PATCH**: Bug fixes, performance improvements

### Release Checklist

1. Lint and build pass (no errors/warnings)
2. E2E smoke tests (manual or automated)
3. Memory/performance profiling (Firefox DevTools)
4. Update AMO listing (description, screenshots)
5. CHANGELOG.md entry
6. Signed ZIP prepared for AMO submission

---

## Code Style & Structure

### Language & Tooling

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with recommended rules
- **Formatting**: Prettier (2-space indent, single quotes)

### Module Organization

```
src/
├── content/          # Content scripts (DOM interaction)
├── background/       # Background scripts (settings management)
├── popup/            # Popup UI (HTML/CSS/JS)
└── shared/           # Shared types/utilities
```

### Namespace

- **Internal**: Use module scope, no globals in `window`
- **Prefix**: Internal identifiers use `LS_*` prefix only within modules (not exposed globally)

---

## Definition of Done (Signals Readiness)

### Test Plan

✅ All acceptance tests passed on Firefox ≥ 115 (Windows/macOS/Linux)

### Privacy Verification

✅ Zero network requests from extension (verified via network monitor)

### Packaging

✅ Signed ZIP for AMO submission
✅ README with installation/usage instructions
✅ PRIVACY.md documenting data handling (none)
✅ Screenshots (3-5) for AMO listing

### Code Quality

✅ TypeScript compilation with no errors
✅ ESLint passes with zero warnings
✅ No console errors during normal operation

---

## Governance

### Authority

This constitution is the supreme governance document for LightSession for ChatGPT (Firefox). In case of conflict between this document and other artifacts (code comments, inline docs, issue discussions), **the constitution takes precedence**.

### Amendment Process

1. **Proposal**: Document proposed change with rationale
2. **Review**: Technical review by maintainer(s)
3. **Approval**: Explicit approval required before implementation
4. **Migration**: Update all dependent templates and documentation
5. **Version bump**: Increment constitution version per SemVer rules

### Compliance Review

- **All PRs**: Must verify compliance with constitutional principles
- **Code review checklist**: Reference specific constitution sections
- **Complexity justification**: Any violation of principles (e.g., performance budget exceeded) must include written justification and simpler alternative analysis

### Agent Guidance

- **During specification**: Reference §4 (Interface Contracts), §5 (DOM Heuristics)
- **During implementation**: Enforce §1 (Principles), §2 (Prohibitions), §7 (Performance Budgets)
- **During testing**: Execute §11 (Acceptance Test Plan), verify §15 (Definition of Done)

---

**Version**: 1.0.0 | **Ratified**: 2025-11-05 | **Last Amended**: 2025-11-05
