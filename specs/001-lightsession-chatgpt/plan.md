# Implementation Plan: LightSession for ChatGPT

**Branch**: `001-lightsession-chatgpt` | **Date**: 2025-11-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-lightsession-chatgpt/spec.md`

## Summary

Build a Firefox browser extension (Manifest V3) that optimizes ChatGPT's performance by automatically trimming long conversation threads in the DOM. The extension keeps only the last N messages visible (default: 10, range: 1-100) to reduce memory usage by 25-50% and maintain 60fps responsiveness. Core features include intelligent message preservation (system/tool messages), pause-on-scroll-up, streaming detection, and fail-safe multi-tier DOM selectors. Architecture: TypeScript-based with content scripts, background scripts, and popup UI, using browser.storage.local for settings persistence. Privacy-first: zero network requests, all processing local.

## Technical Context

**Language/Version**: TypeScript 5.x (compiled to ES2020), compatible with Firefox 115+ WebExtensions APIs
**Primary Dependencies**:
- Firefox WebExtensions API (`browser.*` namespace)
- No external runtime dependencies (self-contained extension)
- Development: ESLint, Prettier, TypeScript compiler, web-ext (Firefox extension CLI)

**Storage**: browser.storage.local for settings persistence (LsSettings schema)
**Testing**: Manual testing with Firefox DevTools, memory profiling, test ChatGPT conversations
**Target Platform**: Firefox ≥ 115 (Windows/macOS/Linux) - Manifest V3 with background.scripts
**Project Type**: Browser extension (specialized single-artifact structure: extension/)
**Performance Goals**:
- Single batch DOM operations ≤ 16ms main thread blocking
- 25-50% heap reduction on 100+ message conversations
- 60fps scroll performance maintained
- Debounced MutationObserver (50-100ms batching)

**Constraints**:
- Zero network requests (privacy-first, local-only)
- No CSP violations (no eval, unsafe-inline, external scripts)
- Domains restricted to chat.openai.com and chatgpt.com only
- Fail-safe: < 6 valid messages detected = no trimming
- Firefox-specific: background.scripts (not service_worker), no :has() CSS selector

**Scale/Scope**:
- Target conversations: 10-500 messages (optimal 50-200 range)
- DOM nodes managed: hundreds to thousands per page
- Settings footprint: < 1KB in storage.local
- Extension size: < 100KB total (minimal dependencies)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Compliance

✅ **I. Privacy-First, Local Operation**:
- Status: COMPLIANT
- Evidence: Architecture uses only browser.storage.local; no fetch/XHR/WebSocket APIs; content scripts isolated

✅ **II. Fail-Safe Operation**:
- Status: COMPLIANT
- Evidence: Multi-tier selector fallback (A/B/C); 6-message minimum threshold; try-catch on DOM operations; abort on uncertainty

✅ **III. Non-Intrusive Scope**:
- Status: COMPLIANT
- Evidence: host_permissions limited to chat.openai.com and chatgpt.com; no other domains

✅ **IV. Reversibility**:
- Status: COMPLIANT
- Evidence: DOM-only modifications; page reload restores full history; no server-side changes

✅ **V. Performance Budget**:
- Status: COMPLIANT
- Evidence: requestIdleCallback for 5-10 node chunks; 16ms main thread limit; debounced MutationObserver (50-100ms)

✅ **VI. User Control**:
- Status: COMPLIANT
- Evidence: Popup UI with all required controls (toggle, N slider 1-100, preserve system/tool, pause-on-scroll-up)

✅ **VII. Transparency**:
- Status: COMPLIANT
- Evidence: Optional debug mode with "LS:" prefix; minimal permissions (storage only)

### Platform Constraints Compliance

✅ **Manifest V3 Requirements**:
- manifest_version: 3
- background.scripts (Firefox-specific, not service_worker)
- permissions: ["storage"] only
- host_permissions: ChatGPT domains only
- browser_specific_settings.gecko.id: Required

✅ **Browser Compatibility**:
- Target: Firefox ≥ 115
- No :has() CSS selector usage
- browser.* namespace (Firefox standard)

### Security & Prohibitions Compliance

✅ **Network & Privacy**: No network modification, data exfiltration, or telemetry
✅ **Code Injection & Security**: No eval, Function(), innerHTML with untrusted strings; CSP compliant
✅ **Scope Creep**: Only ChatGPT domains; no ads/monetization

**GATE RESULT**: ✅ PASS - All constitutional requirements met. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-lightsession-chatgpt/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (technology decisions & patterns)
├── data-model.md        # Phase 1 output (entities & state management)
├── quickstart.md        # Phase 1 output (development setup)
├── contracts/           # Phase 1 output (internal API contracts)
│   ├── storage-schema.ts    # LsSettings interface
│   ├── message-protocol.ts  # runtime.sendMessage contracts
│   └── content-api.ts       # Internal content script API
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Structure Decision**: Browser extension structure (specialized single-artifact pattern)

```text
extension/
├── manifest.json            # Firefox MV3 manifest
├── icons/                   # Extension icons (16/32/48/128)
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── src/
│   ├── content/             # Content scripts (injected into ChatGPT pages)
│   │   ├── content.ts       # Main content script entry point
│   │   ├── dom-helpers.ts   # DOM detection & selector strategies
│   │   ├── trimmer.ts       # Trimming state machine
│   │   └── observers.ts     # MutationObserver & scroll detection
│   ├── background/          # Background scripts (event page)
│   │   └── background.ts    # Settings management & message routing
│   ├── popup/               # Popup UI
│   │   ├── popup.html       # Popup interface
│   │   ├── popup.ts         # Popup logic
│   │   └── popup.css        # Popup styles
│   ├── shared/              # Shared types & utilities
│   │   ├── types.ts         # LsSettings, NodeInfo, MsgRole interfaces
│   │   ├── constants.ts     # Defaults, selectors, timing constants
│   │   └── logger.ts        # Debug logging utility
│   └── options/             # Options page (optional, future)
│       ├── options.html
│       └── options.ts
├── dist/                    # Compiled output (TypeScript → JS)
├── web-ext-artifacts/       # Signed extension builds
├── tsconfig.json            # TypeScript configuration
├── .eslintrc.json           # ESLint configuration
├── .prettierrc              # Prettier configuration
└── package.json             # Development dependencies

tests/
├── manual/                  # Manual test procedures
│   ├── long-thread-test.md
│   ├── scroll-pause-test.md
│   └── streaming-test.md
└── fixtures/                # Test data & screenshots
    └── test-conversations/
```

**Rationale**: Browser extensions have a specialized structure mandated by Firefox WebExtensions architecture. The `extension/` directory contains all distributable code, with `src/` for TypeScript source and `dist/` for compiled JavaScript. This structure supports:
- Clear separation between content scripts (run in ChatGPT context), background scripts (persistent state), and UI (popup)
- TypeScript compilation workflow with tsconfig targeting specific output directory
- Firefox web-ext tooling for testing and packaging
- Modular architecture aligned with constitution §14 requirements

## Complexity Tracking

> **No violations requiring justification**

This extension architecture follows browser extension best practices and constitutional requirements without introducing unnecessary complexity. The three-tier script architecture (content/background/popup) is mandated by Firefox WebExtensions platform, not a design choice.

---

## Phase 0: Research & Technology Decisions

**Status**: ⏳ Pending research agent execution

Research tasks to be completed:
1. Firefox MV3 background.scripts best practices (vs Chrome service_worker)
2. MutationObserver performance patterns for large DOM trees
3. DOM selector resilience strategies for frequently-changing third-party UIs
4. TypeScript browser extension build toolchain (tsconfig, bundling, source maps)
5. browser.storage.local patterns and limitations
6. requestIdleCallback scheduling strategies for batch operations
7. IntersectionObserver vs scroll event patterns for scroll detection
8. Firefox CSP policies for extensions (what's allowed/forbidden)

**Output**: `research.md` with decisions, rationale, and alternatives considered

---

## Phase 1: Design Artifacts

**Status**: ⏳ Pending (depends on Phase 0 completion)

Artifacts to generate:
1. **data-model.md**: Entity definitions (LsSettings, NodeInfo, MsgRole, TrimmerState), state transitions, validation rules
2. **contracts/**: Internal API contracts (storage schema, message protocol, content script API signatures)
3. **quickstart.md**: Development environment setup, build commands, testing workflow, debugging tips

---

## Notes

- Constitution check passed with zero violations
- Extension structure optimized for Firefox MV3 requirements
- Privacy-first architecture: no external dependencies or network access
- Performance budget enforced through architectural constraints (batching, idle callbacks, debouncing)
- Fail-safe mechanisms built into core design (multi-tier selectors, minimum message threshold)
- All user stories from spec.md (P1-P3) supported by this technical approach
