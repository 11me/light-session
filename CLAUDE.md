# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm install          # Install dependencies
npm run build        # Build extension (esbuild)
npm run dev          # Run in Firefox Developer Edition with auto-reload
npm run test         # Run unit tests (vitest)
npm run test:watch   # Run tests in watch mode
npm run lint         # ESLint check
npm run lint:fix     # ESLint autofix
npm run build:types  # TypeScript type check (no emit)
```

## Architecture

**Firefox extension (Manifest V3)** that uses Fetch Proxy to trim ChatGPT conversations before React renders.

### Core Components

| Component | Path | Purpose |
|-----------|------|---------|
| Page Script | `extension/src/page/` | Fetch Proxy, intercepts API responses |
| Content Script | `extension/src/content/` | Settings dispatch, status bar UI |
| Background | `extension/src/background/` | Settings storage |
| Popup | `extension/src/popup/` | Extension toolbar UI |
| Shared | `extension/src/shared/` | Types, constants, storage, logger |

### Fetch Proxy Flow

```
page-inject.ts (document_start) → injects page-script.ts
page-script.ts → patches window.fetch → intercepts /backend-api/ responses
content.ts → dispatches settings via CustomEvent → receives status updates
```

**Trimming flow:**
1. Page script intercepts GET `/backend-api/` JSON responses
2. Parses conversation `mapping` and `current_node`
3. Builds path from current_node to root via parent links
4. Counts MESSAGES (role transitions), not individual nodes
5. Keeps last N messages, filters to user/assistant only
6. Returns modified Response with trimmed JSON

### Message-Based Counting

ChatGPT creates multiple nodes per assistant response (especially with Extended Thinking).
LightSession counts **messages** (role changes) instead of nodes:
- `[user, assistant, assistant, user, assistant]` = 4 messages
- Consecutive same-role nodes are aggregated as ONE message
- HIDDEN_ROLES: `system`, `tool`, `thinking` excluded from count

## Project Structure

```
extension/src/
├── page/            # Page script (Fetch Proxy, runs in page context)
├── content/         # Content scripts (settings, status bar)
├── background/      # Background service worker
├── popup/           # Popup HTML/CSS/TS
└── shared/          # Types, constants, storage, logger
tests/               # Unit tests (vitest + happy-dom)
build.cjs            # esbuild build script (CommonJS)
```

## Conventions

- ES modules (`"type": "module"` in package.json)
- ESLint 9 flat config (`eslint.config.js`)
- Strict TypeScript (`noUncheckedIndexedAccess: true`)
- Prefix logs with `[LS:DEBUG]`, `[LS:INFO]`, `[LS:WARN]`, `[LS:ERROR]`
