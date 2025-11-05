# Tasks: LightSession for ChatGPT

**Input**: Design documents from `/specs/001-lightsession-chatgpt/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No tests explicitly requested in specification - manual testing with Firefox DevTools as specified in quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Browser extension**: `extension/src/`, `extension/dist/` at repository root
- TypeScript source in `extension/src/`, compiled output in `extension/dist/`
- Manifest and icons in `extension/` root

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize extension directory structure, configuration files, and development tooling

- [ ] T001 Create extension directory structure (extension/{src/{content,background,popup,shared},dist,icons})
- [ ] T002 [P] Initialize package.json with dev dependencies (typescript, eslint, prettier, web-ext, @types/firefox-webext-browser)
- [ ] T003 [P] Create tsconfig.json for TypeScript compilation (ES2020 target, extension/src → extension/dist)
- [ ] T004 [P] Create .eslintrc.json with TypeScript ESLint configuration
- [ ] T005 [P] Create .prettierrc with code formatting rules
- [ ] T006 Create extension/manifest.json with Manifest V3 configuration for Firefox
- [ ] T007 [P] Add placeholder icons to extension/icons/ (16x16, 32x32, 48x48, 128x128)
- [ ] T008 [P] Create npm scripts in package.json (build, watch, lint, format, dev, package)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create shared types in extension/src/shared/types.ts (LsSettings, NodeInfo, MsgRole, TrimmerState, SelectorTier)
- [ ] T010 [P] Create shared constants in extension/src/shared/constants.ts (TIMING, DOM, SELECTOR_TIERS)
- [ ] T011 [P] Create logger utility in extension/src/shared/logger.ts (logDebug, logWarn, logError with "LS:" prefix)
- [ ] T012 Implement storage schema in extension/src/shared/storage.ts (DEFAULT_SETTINGS, validateSettings, loadSettings, updateSettings)
- [ ] T013 [P] Implement message protocol in extension/src/shared/messages.ts (RuntimeMessage types, sendMessageWithTimeout, createMessageHandler)
- [ ] T014 Create background script in extension/src/background/background.ts (settings management, message routing, storage.onChanged listener)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Enable Performance Optimization (Priority: P1) 🎯 MVP

**Goal**: Automatically trim long conversations to last N messages, making ChatGPT responsive on 100+ message threads

**Independent Test**: Open 100+ message ChatGPT conversation, enable extension, verify UI becomes responsive and only last 10 messages remain visible

### Implementation for User Story 1

- [ ] T015 [P] [US1] Implement selector tier definitions in extension/src/content/selectors.ts (SELECTOR_TIERS A/B/C, collectCandidates function)
- [ ] T016 [P] [US1] Implement visibility detection in extension/src/content/dom-helpers.ts (isVisible, findScrollableAncestor, findConversationRoot)
- [ ] T017 [US1] Implement role detection in extension/src/content/dom-helpers.ts (detectRole function with data attribute, structural, and ARIA heuristics)
- [ ] T018 [US1] Implement node ID generation in extension/src/content/dom-helpers.ts (getNodeId with data-message-id fallback to hash)
- [ ] T019 [US1] Implement buildActiveThread in extension/src/content/dom-helpers.ts (collect visible nodes, validate Y-monotonicity, create NodeInfo array)
- [ ] T020 [US1] Implement streaming detection in extension/src/content/stream-detector.ts (isStreaming function checking progress bars, typing indicators, "Stop generating" button)
- [ ] T021 [US1] Implement debounced MutationObserver in extension/src/content/observers.ts (createDebouncedObserver with 75ms debounce)
- [ ] T022 [US1] Implement trimmer state machine in extension/src/content/trimmer.ts (TrimmerState initialization, boot/shutdown functions)
- [ ] T023 [US1] Implement trim scheduling in extension/src/content/trimmer.ts (scheduleTrim with debouncing, evaluateTrim with precondition checks)
- [ ] T024 [US1] Implement calculateKeepCount in extension/src/content/trimmer.ts (base keep count, no preservation logic yet)
- [ ] T025 [US1] Implement executeTrim in extension/src/content/trimmer.ts (requestIdleCallback batching, 5-10 nodes per chunk, 16ms budget, Comment('ls-removed') markers)
- [ ] T026 [US1] Create content script entry point in extension/src/content/content.ts (boot on DOMContentLoaded, wire up state machine, handle storage changes)
- [ ] T027 [US1] Wire up MutationObserver to trimmer in extension/src/content/content.ts (observe conversation root, trigger trim evaluation on mutations)
- [ ] T028 [US1] Add debug logging throughout trimmer lifecycle (selector tier used, candidate count, trim preconditions, nodes removed)

**Checkpoint**: At this point, User Story 1 should be fully functional - extension trims to last N messages automatically

---

## Phase 4: User Story 2 - Customize Message Retention (Priority: P2)

**Goal**: Allow users to configure message retention limit (1-100) via popup UI

**Independent Test**: Adjust N slider in popup, verify conversation immediately adjusts to show exactly N messages

### Implementation for User Story 2

- [ ] T029 [P] [US2] Create popup HTML structure in extension/src/popup/popup.html (title, enable toggle, N slider with label, status display)
- [ ] T030 [P] [US2] Create popup CSS styles in extension/src/popup/popup.css (layout, slider styling, toggle button, accessibility focus states)
- [ ] T031 [US2] Implement popup settings loader in extension/src/popup/popup.ts (load current settings via GET_SETTINGS message on popup open)
- [ ] T032 [US2] Implement N slider handler in extension/src/popup/popup.ts (update settings.keep, send SET_SETTINGS message, debounce writes 100ms)
- [ ] T033 [US2] Implement enable/disable toggle in extension/src/popup/popup.ts (update settings.enabled, send SET_SETTINGS message, update UI state)
- [ ] T034 [US2] Add real-time N display in extension/src/popup/popup.ts (show current limit prominently, update as slider moves)
- [ ] T035 [US2] Implement settings persistence in extension/src/popup/popup.ts (ensure settings save correctly, handle timeout errors)
- [ ] T036 [US2] Update content script to react to settings changes in extension/src/content/content.ts (storage.onChanged listener, re-evaluate trim when keep changes)
- [ ] T037 [US2] Add input validation to popup in extension/src/popup/popup.ts (clamp N to [1,100], prevent invalid values)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can customize how many messages to keep

---

## Phase 5: User Story 3 - Preserve Important Context (Priority: P2)

**Goal**: Preserve system and tool messages beyond normal limit when preservation enabled

**Independent Test**: Create conversation with system/tool messages, enable preservation, verify they remain visible beyond N limit

### Implementation for User Story 3

- [ ] T038 [P] [US3] Enhance detectRole in extension/src/content/dom-helpers.ts to identify system/tool messages (check for tool call indicators, data-tool-call-id, system badges)
- [ ] T039 [US3] Update calculateKeepCount in extension/src/content/trimmer.ts to count system/tool messages (add systemToolCount to base keep when preserveSystem true)
- [ ] T040 [US3] Update evaluateTrim in extension/src/content/trimmer.ts to filter preserved messages (exclude system/tool from toRemove array when preserveSystem true)
- [ ] T041 [P] [US3] Add preservation checkbox to extension/src/popup/popup.html ("Preserve system/tool messages")
- [ ] T042 [US3] Implement preservation toggle handler in extension/src/popup/popup.ts (update settings.preserveSystem, send SET_SETTINGS message)
- [ ] T043 [US3] Add preservation status to debug logs in extension/src/content/trimmer.ts (log preserved message count, which messages exempted)
- [ ] T044 [US3] Test role detection accuracy in extension/src/content/dom-helpers.ts (ensure system/tool correctly identified, log unknown roles)

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should work - preservation protects important context

---

## Phase 6: User Story 4 - Review Conversation History (Priority: P3)

**Goal**: Pause trimming when user scrolls up to review older messages

**Independent Test**: Scroll up in optimized conversation, verify no additional messages removed, scroll to bottom, verify trimming resumes

### Implementation for User Story 4

- [ ] T045 [P] [US4] Implement scroll tracking in extension/src/content/observers.ts (setupScrollTracking with throttled scroll event, 100ms throttle)
- [ ] T046 [US4] Implement isAtBottom detection in extension/src/content/observers.ts (check scrollTop + clientHeight vs scrollHeight with 100px threshold)
- [ ] T047 [US4] Update trimmer state in extension/src/content/trimmer.ts to track scroll position (add isAtBottom to TrimmerState)
- [ ] T048 [US4] Update evaluateTrim preconditions in extension/src/content/trimmer.ts (check pauseOnScrollUp && !isAtBottom, abort trim if true)
- [ ] T049 [US4] Wire up scroll tracking in extension/src/content/content.ts (attach scroll listener to conversation container, update state.isAtBottom)
- [ ] T050 [P] [US4] Add "Pause when scrolled up" checkbox to extension/src/popup/popup.html
- [ ] T051 [US4] Implement pause toggle handler in extension/src/popup/popup.ts (update settings.pauseOnScrollUp, send SET_SETTINGS message)
- [ ] T052 [US4] Add scroll status to debug logs in extension/src/content/trimmer.ts (log isAtBottom, whether trim paused due to scroll)

**Checkpoint**: At this point, User Stories 1-4 should work - users can review history without interference

---

## Phase 7: User Story 5 - Quick Toggle and Recovery (Priority: P3)

**Goal**: Allow quick enable/disable toggle and page refresh for full history restoration

**Independent Test**: Toggle extension off, verify trimming stops, toggle on, verify trimming resumes, click refresh, verify page reloads

### Implementation for User Story 5

- [ ] T053 [P] [US5] Enhance enable/disable toggle in extension/src/popup/popup.ts (already implemented in T033, verify ON/OFF state visible prominently)
- [ ] T054 [P] [US5] Add refresh button to extension/src/popup/popup.html ("Refresh to restore full history")
- [ ] T055 [US5] Implement refresh handler in extension/src/popup/popup.ts (use browser.tabs.reload on current ChatGPT tab)
- [ ] T056 [US5] Update content script to stop trimming when disabled in extension/src/content/content.ts (check settings.enabled in evaluateTrim, disconnect observer when false)
- [ ] T057 [US5] Implement clean shutdown in extension/src/content/trimmer.ts (disconnect observer, remove listeners, transition to IDLE)
- [ ] T058 [US5] Update content script to resume trimming on re-enable in extension/src/content/content.ts (re-attach observer, evaluate trim immediately)
- [ ] T059 [US5] Add toggle state indicators to popup UI in extension/src/popup/popup.css (color-coded ON=green OFF=gray, aria-pressed state)

**Checkpoint**: All user stories 1-5 complete - full feature set implemented

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, final quality assurance

- [ ] T060 [P] Add keyboard accessibility to popup UI in extension/src/popup/popup.html (aria-labels, proper focus order, Enter/Space handling)
- [ ] T061 [P] Implement ARIA attributes in extension/src/popup/popup.html (aria-checked for checkboxes, aria-valuetext for slider)
- [ ] T062 [P] Add debug mode toggle to extension/src/popup/popup.html (checkbox for settings.debug)
- [ ] T063 [US5] Implement debug toggle handler in extension/src/popup/popup.ts (update settings.debug, show/hide debug info section)
- [ ] T064 [P] Create manual test procedure in tests/manual/long-thread-test.md (steps to test 100+ message conversation, verify memory reduction)
- [ ] T065 [P] Create manual test procedure in tests/manual/scroll-pause-test.md (steps to test scroll-up pause behavior)
- [ ] T066 [P] Create manual test procedure in tests/manual/streaming-test.md (steps to test streaming detection and deferral)
- [ ] T067 [P] Create manual test procedure in tests/manual/settings-persistence-test.md (steps to verify settings survive browser restart)
- [ ] T068 [P] Create manual test procedure in tests/manual/system-tool-preservation-test.md (steps to verify preservation behavior)
- [ ] T069 Run full linting pass (npm run lint, fix all issues)
- [ ] T070 Run code formatting (npm run format, ensure consistent style)
- [ ] T071 Test extension on Firefox 115+ (verify compatibility, no console errors)
- [ ] T072 Profile memory usage with Firefox DevTools (heap snapshots before/after trim, verify 25-50% reduction)
- [ ] T073 Profile performance with Firefox DevTools (verify <16ms main thread blocking, 60fps scroll)
- [ ] T074 Test on all target platforms (Windows, macOS, Linux with Firefox 115+)
- [ ] T075 [P] Create README.md in repository root (installation, usage, features, privacy statement)
- [ ] T076 [P] Create PRIVACY.md documenting zero data collection
- [ ] T077 Package extension for AMO submission (npm run package, verify web-ext-artifacts output)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (Phase 3): No dependencies on other stories - can start after Foundational
  - US2 (Phase 4): Depends on US1 (needs trimmer to adjust N) - sequential dependency
  - US3 (Phase 5): Depends on US1 (extends trimmer logic) - can run parallel with US2 after US1
  - US4 (Phase 6): Depends on US1 (extends trimmer preconditions) - can run parallel with US2/US3 after US1
  - US5 (Phase 7): Depends on US2 (uses toggle from US2) - sequential after US2
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Foundational (Phase 2)
    │
    ├─> US1 (Phase 3) [P1 - MVP Core]
    │    │
    │    ├─> US2 (Phase 4) [P2 - Customization] ──> US5 (Phase 7) [P3 - Toggle/Refresh]
    │    │
    │    ├─> US3 (Phase 5) [P2 - Preservation] ─┐
    │    │                                        ├─> Polish (Phase 8)
    │    └─> US4 (Phase 6) [P3 - Scroll Pause] ─┘
```

**Critical Path**: Setup → Foundational → US1 → US2 → US5 → Polish (minimum viable)

**Parallel Opportunities After US1**:
- US2 and US3 can run in parallel (different files/features)
- US3 and US4 can run in parallel (different files/features)
- US2 must complete before US5 (uses toggle UI)

### Within Each User Story

- **US1**: Selectors and DOM helpers → Observers → Trimmer state machine → Content script entry point
- **US2**: Popup HTML/CSS → Popup logic → Settings handlers (can run parallel)
- **US3**: Role detection → calculateKeepCount → evaluateTrim filter → Popup UI (mostly sequential)
- **US4**: Scroll observers → Trimmer preconditions → Popup UI (can run parallel)
- **US5**: Leverage existing toggle, add refresh → Test integration (mostly reuse)

### Parallel Opportunities

**Within Setup (Phase 1)**:
```bash
# All can run in parallel:
Task T002: Initialize package.json
Task T003: Create tsconfig.json
Task T004: Create .eslintrc.json
Task T005: Create .prettierrc
Task T007: Add placeholder icons
```

**Within Foundational (Phase 2)**:
```bash
# These can run in parallel:
Task T010: Create shared constants
Task T011: Create logger utility
```

**Within User Story 1 (Phase 3)**:
```bash
# These can run in parallel (different files):
Task T015: Implement selector tiers (selectors.ts)
Task T016: Implement visibility detection (dom-helpers.ts)
Task T020: Implement streaming detection (stream-detector.ts)
Task T021: Implement debounced observer (observers.ts)
```

**Within User Story 2 (Phase 4)**:
```bash
# These can run in parallel:
Task T029: Create popup HTML
Task T030: Create popup CSS
```

**Within Polish (Phase 8)**:
```bash
# These can run in parallel:
Task T060: Add keyboard accessibility
Task T061: Implement ARIA attributes
Task T062: Add debug mode toggle
Task T064-T068: Create all manual test procedures (5 files)
Task T075: Create README.md
Task T076: Create PRIVACY.md
```

---

## Parallel Example: User Story 1 (Core Implementation)

```bash
# Launch these tasks in parallel (different files):
Task T015: extension/src/content/selectors.ts
Task T016: extension/src/content/dom-helpers.ts (visibility)
Task T020: extension/src/content/stream-detector.ts
Task T021: extension/src/content/observers.ts

# Sequential after above:
Task T017-T019: Complete dom-helpers.ts (role detection, ID generation, buildActiveThread)
Task T022-T025: Complete trimmer.ts (state machine, scheduling, execution)
Task T026-T028: Complete content.ts (entry point, wiring, logging)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only - P1)

1. Complete Phase 1: Setup → **Extension structure ready**
2. Complete Phase 2: Foundational → **Foundation ready, types/storage/background working**
3. Complete Phase 3: User Story 1 → **MVP complete: auto-trimming to N messages works**
4. **STOP and VALIDATE**: Test on ChatGPT with 100+ message conversation
   - Verify responsiveness improves
   - Verify only last 10 messages remain
   - Verify no console errors
   - Profile memory reduction (should see 25-50% decrease)
5. Deploy MVP / Demo to stakeholders

**MVP Scope**: Phases 1-3 = 28 tasks = Fully functional auto-trimming extension

### Incremental Delivery (All P1 + P2)

1. Complete Setup + Foundational → **Foundation ready**
2. Add User Story 1 (P1) → **Test independently** → **MVP deployed**
3. Add User Story 2 (P2) → **Test independently** → **Customization feature deployed**
4. Add User Story 3 (P2) → **Test independently** → **Preservation feature deployed**
5. Each story adds value without breaking previous stories

**Full P1+P2 Scope**: Phases 1-5 = 44 tasks = Core + Customization + Preservation

### Complete Feature Set (All P1 + P2 + P3)

1. Complete Foundation + US1-3 → **Core features ready**
2. Add User Story 4 (P3) → **Scroll pause feature deployed**
3. Add User Story 5 (P3) → **Toggle/refresh feature deployed**
4. Add Polish → **Production ready**

**Complete Scope**: All 8 phases = 77 tasks = Full feature set + manual tests + documentation

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (Phases 1-2)
2. Once Foundational done:
   - **Developer A**: User Story 1 (Phase 3) - Core trimming
   - Developer B waits for US1 core files (T026 content.ts complete)
3. After US1 complete:
   - **Developer A**: User Story 3 (Phase 5) - Preservation logic
   - **Developer B**: User Story 2 (Phase 4) - Popup UI
   - **Developer C**: User Story 4 (Phase 6) - Scroll tracking
4. After US2 complete:
   - **Developer D**: User Story 5 (Phase 7) - Toggle/refresh
5. **All together**: Polish (Phase 8) - Testing and documentation

---

## Notes

- **[P] tasks** = different files, no dependencies on incomplete work in same phase
- **[Story] label** maps task to specific user story for traceability
- Each user story should be independently completable and testable once its dependencies are met
- No automated tests requested in spec.md - all testing is manual with Firefox DevTools
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Performance validation** required: Use Firefox DevTools Memory and Performance tabs to verify <16ms batching and 25-50% heap reduction
- **Accessibility validation** required: Test keyboard navigation and screen reader compatibility in popup
- Avoid: vague tasks, same file conflicts, hidden dependencies between stories

---

## Task Count Summary

| Phase | User Story | Task Count | Can Start After |
|-------|------------|------------|------------------|
| 1 | Setup | 8 | Immediate |
| 2 | Foundational | 6 | Phase 1 |
| 3 | US1 (P1 - MVP) | 14 | Phase 2 |
| 4 | US2 (P2) | 9 | Phase 3 |
| 5 | US3 (P2) | 7 | Phase 3 |
| 6 | US4 (P3) | 8 | Phase 3 |
| 7 | US5 (P3) | 7 | Phase 4 |
| 8 | Polish | 18 | Phases 3-7 |
| **Total** | | **77** | |

**MVP (P1 only)**: 28 tasks (Phases 1-3)
**Core + Customization (P1+P2)**: 44 tasks (Phases 1-5)
**Full Feature Set**: 77 tasks (All phases)

**Parallel Tasks**: 23 tasks marked [P] across all phases
**Sequential Tasks**: 54 tasks (dependencies within or across phases)
**Independent User Stories**: US1 is independently deliverable MVP; US2-5 add incremental value
