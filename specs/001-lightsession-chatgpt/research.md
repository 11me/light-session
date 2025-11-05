# Research & Technology Decisions: LightSession for ChatGPT

**Feature**: 001-lightsession-chatgpt
**Date**: 2025-11-05
**Purpose**: Document technology choices, patterns, and best practices for implementing the Firefox extension

## Overview

This document consolidates research findings for building a privacy-first, high-performance Firefox browser extension that optimizes ChatGPT conversations through intelligent DOM manipulation. All decisions prioritize constitutional requirements (privacy, fail-safe operation, performance budget) and Firefox MV3 platform constraints.

---

## 1. Firefox MV3 Background Scripts Architecture

### Decision: Use background.scripts with Event Page Pattern

**Rationale**:
- Firefox MV3 requires `background.scripts` (not `service_worker` like Chrome)
- Event pages persist for the session but can be unloaded when inactive
- Suitable for our lightweight settings management and message routing needs
- No persistent timers or long-running processes required

**Implementation Pattern**:
```javascript
// manifest.json
"background": {
  "scripts": ["dist/background/background.js"]
  // Note: No "persistent": false in Firefox MV3, it's implicit
}
```

**Best Practices**:
1. **Stateless Message Handlers**: Background script responds to runtime.onMessage but doesn't maintain complex state
2. **Storage as Source of Truth**: Settings always read from browser.storage.local, not cached in memory
3. **Lazy Initialization**: Initialize only when first message received from content script or popup
4. **Error Boundaries**: Wrap message handlers in try-catch to prevent background script crashes

**Alternatives Considered**:
- **Content-script-only architecture**: Rejected because settings need to persist across page navigations and be accessible from popup without content script injection
- **Service Worker (Chrome MV3)**: Not available in Firefox; background.scripts is platform requirement

**References**:
- Firefox WebExtensions background scripts documentation
- MDN: manifest.json/background key

---

## 2. MutationObserver Performance Patterns

### Decision: Single Observer with Debounced Batch Processing

**Rationale**:
- Single MutationObserver on conversation container (not individual messages) reduces overhead
- Debouncing (50-100ms) batches rapid mutations during streaming responses
- requestIdleCallback for non-urgent trimming operations prevents jank
- Aligns with Performance Budget constitutional requirement (≤16ms main thread blocking)

**Implementation Pattern**:
```typescript
let trimScheduled = false;
const DEBOUNCE_MS = 75; // Middle of 50-100ms range

const observer = new MutationObserver((mutations) => {
  if (trimScheduled) return;
  trimScheduled = true;

  setTimeout(() => {
    trimScheduled = false;
    scheduleTrim(); // Checks preconditions, then trims via requestIdleCallback
  }, DEBOUNCE_MS);
});

observer.observe(conversationRoot, {
  childList: true,
  subtree: true
});
```

**Performance Characteristics**:
- **Overhead per mutation**: ~0.1ms (negligible)
- **Batch processing**: Aggregates 10-50 mutations into single trim evaluation
- **Main thread blocking**: <5ms for trim evaluation, <16ms per batch delete
- **Memory**: ~100-200 bytes per MutationRecord, cleared after processing

**Best Practices**:
1. **Disconnect during trimming**: Temporarily disconnect observer while removing nodes to avoid triggering itself
2. **Filter mutations**: Only process childList mutations on relevant subtrees
3. **Throttle vs Debounce**: Use debounce (wait for quiet period) not throttle (execute periodically), because we want to trim after streaming completes
4. **Microtask for state checks**: Use queueMicrotask() for cheap precondition checks before expensive trim logic

**Alternatives Considered**:
- **Polling (setInterval)**: Rejected due to unnecessary CPU usage when conversation idle
- **Multiple observers per message**: Rejected due to excessive memory overhead (N observers for N messages)
- **Synchronous processing**: Rejected due to frame drops during trimming

**References**:
- MDN: MutationObserver
- Web Performance Working Group: requestIdleCallback spec
- "Performant Mutation Observation" (Google Web Fundamentals)

---

## 3. DOM Selector Resilience Strategies

### Decision: Multi-Tier Fallback with Feature Detection

**Rationale**:
- ChatGPT UI changes frequently (weekly deployments common)
- Brittle selectors (specific class names like `.chat-message-abc123`) break immediately
- Feature-based detection (data-attributes, ARIA roles, structural patterns) more durable
- Aligns with Fail-Safe Operation constitutional requirement

**Implementation Pattern** (from tz.md § 6.5):

```typescript
const SELECTOR_PROBES = [
  // Tier A: Current UI (data attributes)
  ['[data-message-id]', 'article[data-message-id]', '[data-message-author]'],

  // Tier B: Fallback (test IDs and roles)
  ['[data-testid*="message" i]', 'article[role="article"]', 'div[role="article"]'],

  // Tier C: Defensive (structural + content-based)
  ['article', 'div', 'li'] // + filter by containing text content blocks
];

function collectCandidates(): HTMLElement[] {
  for (const probe of SELECTOR_PROBES) {
    const nodes = [...new Set(
      probe.flatMap(sel => Array.from(document.querySelectorAll<HTMLElement>(sel)))
    )];

    const filtered = nodes.filter(isLikelyMessage);

    if (filtered.length >= 6 && isSequenceValid(filtered)) {
      // Log which tier succeeded if debug mode
      return filtered;
    }
  }

  // Fail-safe: return empty if no tier succeeds
  return [];
}
```

**Validation Rules** (tz.md § 6.5.6):
1. **Visibility**: `el.offsetParent !== null && el.getClientRects().length > 0`
2. **Monotonicity**: Y-coordinates ascending (±4px tolerance for flex/grid layouts)
3. **Size threshold**: Average message height > 24px (filter micro-elements)
4. **Root consistency**: ≥80% of candidates share same scrollable ancestor

**Best Practices**:
1. **Progressive refinement**: Start broad, filter down (not start specific and fail)
2. **Case-insensitive matching**: Use `[data-testid*="..." i]` for resilience to capitalization changes
3. **Avoid :has()**: Not supported in Firefox 115, use closest() and querySelector() instead
4. **Log failures in debug mode**: When all tiers fail, log DOM structure snapshot to console
5. **Quarterly audits**: Review selector success rates, add new tiers if needed

**Alternatives Considered**:
- **Single hardcoded selector**: Rejected, breaks on every UI update
- **ML-based element detection**: Rejected, violates privacy-first (no models, processing overhead)
- **XPath selectors**: Rejected, less performant and less maintainable than CSS + feature detection

**References**:
- tz.md § 6.5 (authoritative selector specification)
- "Resilient Web Design" patterns for third-party integrations
- Firefox CSS selector support matrix

---

## 4. TypeScript Browser Extension Build Toolchain

### Decision: TypeScript + Native Browser APIs (No Bundler)

**Rationale**:
- Modern browsers support ES modules natively
- No bundler reduces build complexity and attack surface (supply chain security)
- TypeScript provides type safety without runtime cost
- Aligns with "no external dependencies" constitutional requirement

**Build Configuration**:

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "lib": ["ES2020", "DOM"],
    "outDir": "extension/dist",
    "rootDir": "extension/src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["firefox-webext-browser"]
  },
  "include": ["extension/src/**/*"],
  "exclude": ["node_modules", "extension/dist", "tests"]
}
```

**package.json** (dev dependencies only):
```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/firefox-webext-browser": "^120.0.0",
    "web-ext": "^7.11.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "prettier": "^3.2.0"
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "lint": "eslint extension/src --ext .ts",
    "format": "prettier --write extension/src/**/*.ts",
    "dev": "web-ext run --source-dir=extension --firefox=firefoxdeveloperedition",
    "package": "web-ext build --source-dir=extension --artifacts-dir=web-ext-artifacts"
  }
}
```

**manifest.json** (ES module imports):
```json
{
  "background": {
    "scripts": ["dist/background/background.js"],
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["*://chat.openai.com/*", "*://chatgpt.com/*"],
    "js": ["dist/content/content.js"],
    "run_at": "document_end"
  }]
}
```

**Best Practices**:
1. **Strict mode**: Enable all TypeScript strict checks (no implicit any, null checks)
2. **Separate tsconfig for tests**: Use tsconfig.test.json if unit tests added later
3. **Source maps**: Enable in dev, disable in production builds
4. **Type-only imports**: Use `import type` for interfaces to avoid runtime imports
5. **No polyfills**: Target ES2020, which Firefox 115+ supports natively

**Alternatives Considered**:
- **Webpack/Rollup bundler**: Rejected, adds complexity and build-time dependencies
- **Plain JavaScript**: Rejected, TypeScript provides critical type safety for complex DOM manipulation
- **esbuild/swc**: Rejected, tsc sufficient for extension size, standard tooling preferred

**References**:
- TypeScript Handbook: Project Configuration
- MDN: WebExtensions and JavaScript modules
- web-ext CLI documentation

---

## 5. browser.storage.local Patterns

### Decision: Single Key with Versioned Schema

**Rationale**:
- Single storage key (`ls_settings`) simplifies access and reduces quota usage
- Versioned schema enables future migrations without breaking changes
- Synchronous validation on read prevents invalid states
- storage.local persists indefinitely (vs storage.sync which has quota limits)

**Schema Definition** (from constitution § 4.1):
```typescript
interface LsSettings {
  version: 1; // Schema version for future migrations
  enabled: boolean;        // default: true
  keep: number;            // 1..100, default: 10
  preserveSystem: boolean; // default: true
  pauseOnScrollUp: boolean;// default: true
  debug: boolean;          // default: false
}

const DEFAULT_SETTINGS: LsSettings = {
  version: 1,
  enabled: true,
  keep: 10,
  preserveSystem: true,
  pauseOnScrollUp: true,
  debug: false
};
```

**Access Patterns**:

**Read** (with validation):
```typescript
async function loadSettings(): Promise<LsSettings> {
  const result = await browser.storage.local.get('ls_settings');
  const stored = result.ls_settings;

  // Validate and merge with defaults
  if (!stored || stored.version !== 1) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    keep: Math.max(1, Math.min(100, stored.keep || 10)) // Clamp to valid range
  };
}
```

**Write** (partial updates):
```typescript
async function updateSettings(partial: Partial<Omit<LsSettings, 'version'>>): Promise<void> {
  const current = await loadSettings();
  const updated = { ...current, ...partial };
  await browser.storage.local.set({ ls_settings: updated });
}
```

**Listen for Changes** (in content script):
```typescript
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.ls_settings) {
    const newSettings = changes.ls_settings.newValue;
    applySettings(newSettings);
  }
});
```

**Storage Characteristics**:
- **Quota**: 5MB per extension (we use <1KB)
- **Performance**: Read <1ms, Write <5ms (asynchronous)
- **Persistence**: Survives browser restart, profile changes, extension updates
- **Scope**: Per-browser-profile (not synced across devices)

**Best Practices**:
1. **Always validate on read**: Don't trust stored data (user could edit with devtools)
2. **Partial updates**: Only write changed fields, not entire object
3. **Debounce writes**: If slider updates rapidly, debounce storage writes (100ms)
4. **No sensitive data**: Never store conversation content, only settings
5. **Migration path**: Increment version field if schema changes, handle old versions gracefully

**Alternatives Considered**:
- **storage.sync**: Rejected, 100KB quota limit, unnecessary cross-device sync
- **localStorage**: Rejected, domain-scoped (can't share between content/popup), synchronous blocking API
- **IndexedDB**: Rejected, massive overkill for 5 boolean/number settings
- **Multiple keys**: Rejected, wastes quota and complicates batch reads

**References**:
- MDN: browser.storage.local API
- Firefox storage quota policies
- Extension settings patterns (Chrome/Firefox best practices)

---

## 6. requestIdleCallback Scheduling Strategies

### Decision: Idle-Time Batching with Deadline Budgeting

**Rationale**:
- Trimming is not time-critical (can wait for idle periods)
- 16ms budget per batch (60fps ÷ 4 = 15ms safety margin)
- Chunking large deletions (5-10 nodes per chunk) prevents frame drops
- Aligns with Performance Budget constitutional requirement

**Implementation Pattern**:
```typescript
const CHUNK_SIZE = 7; // Middle of 5-10 node range
const BUDGET_MS = 16; // Maximum time per batch

function scheduleB

atchedTrim(nodesToRemove: HTMLElement[]): void {
  let index = 0;

  function processChunk(deadline: IdleDeadline) {
    const startTime = performance.now();

    // Process nodes while budget remains
    while (index < nodesToRemove.length && deadline.timeRemaining() > 1) {
      const node = nodesToRemove[index];
      const comment = document.createComment('ls-removed');
      node.replaceWith(comment);
      index++;

      // Safety: Don't exceed 16ms even if deadline says we have time
      if (performance.now() - startTime > BUDGET_MS) break;
    }

    // Schedule next chunk if work remains
    if (index < nodesToRemove.length) {
      requestIdleCallback(processChunk, { timeout: 1000 });
    }
  }

  requestIdleCallback(processChunk, { timeout: 1000 });
}
```

**Performance Characteristics**:
- **Latency**: 0-50ms (waits for idle, acceptable for non-critical trimming)
- **Throughput**: ~100 nodes/second (7 nodes × 60fps = 420 nodes/sec theoretical, 100 realistic)
- **Frame impact**: 0ms (runs between frames or during idle)
- **Fallback**: 1000ms timeout ensures progress even if browser busy

**Best Practices**:
1. **Deadline.timeRemaining() unreliable**: Always check elapsed time with performance.now() as backup
2. **Timeout parameter**: Provide timeout (1000ms) so work doesn't stall indefinitely
3. **Disconnect MutationObserver**: Temporarily disconnect before batch delete to avoid observer storm
4. **Comment markers**: Use `document.createComment('ls-removed')` for debugging, not text nodes
5. **Measure in production**: Add debug-mode timing logs to validate <16ms budget

**Alternatives Considered**:
- **setTimeout(0)**: Rejected, not guaranteed to run between frames
- **requestAnimationFrame**: Rejected, runs every frame (blocks rendering even if nothing to do)
- **Synchronous deletion**: Rejected, causes visible jank on large batches
- **Web Worker**: Rejected, can't manipulate DOM from worker (would need postMessage overhead)

**References**:
- MDN: requestIdleCallback
- "Optimize Long Tasks" (web.dev)
- "RAIL Performance Model" (Chrome DevTools)

---

## 7. Scroll Detection Patterns

### Decision: Scroll Event with Throttled Position Check

**Rationale**:
- IntersectionObserver designed for viewport intersection, not scroll position
- Simple scroll event + throttling (100ms) sufficient for "at bottom" detection
- Lower overhead than IntersectionObserver for single position check
- Aligns with "pause when scrolled up" user story (P3)

**Implementation Pattern**:
```typescript
let isAtBottom = true;
let scrollCheckScheduled = false;

function checkScrollPosition(): void {
  const container = findScrollableAncestor(conversationRoot);
  if (!container) return;

  const threshold = 100; // px from bottom = "at bottom"
  const scrollBottom = container.scrollTop + container.clientHeight;
  const isAtBottomNow = (container.scrollHeight - scrollBottom) < threshold;

  if (isAtBottom !== isAtBottomNow) {
    isAtBottom = isAtBottomNow;
    // Re-evaluate trimming if we returned to bottom
    if (isAtBottom) scheduleTrim();
  }

  scrollCheckScheduled = false;
}

function onScroll(): void {
  if (scrollCheckScheduled) return;
  scrollCheckScheduled = true;
  setTimeout(checkScrollPosition, 100); // Throttle
}

// Attach listener
const container = findScrollableAncestor(conversationRoot);
container.addEventListener('scroll', onScroll, { passive: true });
```

**Performance Characteristics**:
- **Event frequency**: ~60 events/sec during active scrolling
- **Throttled frequency**: ~10 checks/sec (100ms throttle)
- **Computation per check**: <1ms (simple arithmetic)
- **Memory**: ~50 bytes (scroll event + closures)

**Best Practices**:
1. **Passive listener**: Use `{ passive: true }` to hint browser scrolling won't be blocked
2. **Throttle not debounce**: Check during scrolling (throttle), not after it stops (debounce)
3. **Threshold tolerance**: 100px grace area (user doesn't need to be pixel-perfect at bottom)
4. **Cache container**: findScrollableAncestor() once on boot, cache result
5. **Disconnect on unmount**: Remove listener in shutdown() to prevent memory leaks

**Alternatives Considered**:
- **IntersectionObserver on last message**: Rejected, more complex setup and teardown than needed
- **Continuous polling**: Rejected, unnecessary CPU usage
- **Scroll event + requestAnimationFrame**: Rejected, over-engineered for simple position check

**References**:
- MDN: scroll event
- "Passive Event Listeners" (Chrome DevTools)
- "Debouncing and Throttling Explained" (CSS-Tricks)

---

## 8. Firefox CSP Policies for Extensions

### Decision: Default Extension CSP (No Relaxation)

**Rationale**:
- Firefox extension CSP default: `script-src 'self'; object-src 'none'`
- Our architecture uses only bundled scripts (no inline, no eval, no remote)
- No need to relax CSP = stronger security posture
- Aligns with Security constitutional requirement (no eval, no unsafe-inline)

**Allowed Patterns**:
✅ **script-src 'self'**: Load scripts from extension:// protocol (our compiled .js files)
✅ **DOM manipulation**: createElement, textContent, appendChild (safe by default)
✅ **CSS**: External stylesheets and inline styles (no JavaScript injection)

**Forbidden Patterns (Violations)**:
❌ **eval() and Function()**: Blocked by CSP, violates constitutional prohibition
❌ **Inline event handlers**: `<button onclick="...">` blocked
❌ **innerHTML with untrusted content**: XSS risk, use textContent or DOM APIs
❌ **Remote scripts**: `<script src="https://...">` blocked
❌ **data: URIs for scripts**: `<script src="data:text/javascript,...">` blocked

**Safe Patterns**:
```typescript
// ✅ SAFE: DOM API
const button = document.createElement('button');
button.textContent = 'Click me';
button.addEventListener('click', handleClick);

// ✅ SAFE: textContent for user data
const message = document.createElement('div');
message.textContent = userInput; // Escapes HTML automatically

// ❌ UNSAFE: innerHTML with untrusted data
div.innerHTML = userInput; // XSS risk!

// ✅ SAFE: Sanitize or use DOM methods
const sanitized = DOMPurify.sanitize(userInput); // If library needed
// OR better: use textContent + DOM construction
```

**Extension-Specific CSP** (manifest.json):
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'"
  }
}
```
*Note: This is the default, explicitly specifying it is optional but documents intent*

**Best Practices**:
1. **Never relax CSP**: If code doesn't work under default CSP, fix the code, don't weaken CSP
2. **Sanitize defensively**: Even though we don't process user content, use textContent for any dynamic text
3. **No eval-like patterns**: Avoid setTimeout/setInterval with string arguments
4. **Audit dependencies**: Dev dependencies (TypeScript, ESLint) don't ship, runtime dependencies (none) must be CSP-safe
5. **Test with strict mode**: Run extension in Firefox Developer Edition with enhanced CSP checking

**Alternatives Considered**:
- **Relax to 'unsafe-inline'**: Rejected, violates constitutional prohibition
- **Relax to 'unsafe-eval'**: Rejected, violates constitutional prohibition and enables XSS
- **Use nonce/hash**: Rejected, unnecessary complexity when 'self' sufficient

**References**:
- MDN: Content Security Policy for WebExtensions
- Firefox Add-on Policies: CSP requirements
- OWASP: Content Security Policy Cheat Sheet

---

## Summary of Key Decisions

| Technology Area | Decision | Primary Rationale |
|----------------|----------|-------------------|
| **Background Script** | background.scripts event page | Firefox MV3 requirement, lightweight state |
| **DOM Observation** | Single MutationObserver + debounce (75ms) | Performance budget, batching mutations |
| **Selector Strategy** | 3-tier fallback (A/B/C) | Resilience to UI changes, fail-safe |
| **Build Toolchain** | TypeScript + tsc (no bundler) | Type safety, zero runtime deps |
| **Settings Storage** | browser.storage.local single key | Simplicity, versioned schema |
| **Batch Processing** | requestIdleCallback with 16ms budget | 60fps target, idle-time utilization |
| **Scroll Detection** | scroll event + throttle (100ms) | Simple, low overhead |
| **Security Policy** | Default CSP (no relaxation) | Constitutional compliance, XSS prevention |

---

## Implementation Priorities

**Phase 1 (Core)**: MutationObserver, selector fallback, trimmer state machine
**Phase 2 (UI)**: Popup, settings storage, background script messaging
**Phase 3 (Polish)**: Scroll detection, streaming detection, debug logging
**Phase 4 (Testing)**: Manual test procedures, memory profiling, edge case validation

---

## Open Questions (To Be Resolved in data-model.md)

1. **State Machine States**: Exact state enumeration for trimmer (idle/observing/pending/trimming)
2. **NodeInfo Lifecycle**: When to attach IDs, how to track nodes across mutations
3. **Selector Tier Switching**: Should we cache successful tier or re-try on every collection?
4. **Streaming Detection**: Specific selectors for "generating" indicators (A/B/C tiers?)

---

**Next Steps**: Proceed to Phase 1 (data-model.md, contracts/, quickstart.md) with these research findings as foundation.
