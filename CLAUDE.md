# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm install            # Install dependencies
npm run build          # Build for Firefox (default)
npm run build:firefox  # Build for Firefox
npm run build:chrome   # Build for Chrome
npm run build:safari   # Build for Safari
npm run dev            # Run in Firefox Developer Edition
npm run watch:chrome   # Watch mode for Chrome development
npm run test           # Run unit tests (vitest)
npm run lint           # ESLint check
npm run build:types    # TypeScript type check
npm run package        # Package for Firefox (web-ext-artifacts/)
npm run package:chrome # Package for Chrome (ZIP)
npm run package:safari # Build for Safari + run safari-web-extension-converter (outputs to web-ext-artifacts/safari/)
```

## Architecture

**Cross-browser extension (Manifest V3)** for Firefox, Chrome, and Safari that uses Fetch Proxy to trim ChatGPT conversations before React renders.

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
LightSession Pro counts **messages** (role changes) instead of nodes:
- `[user, assistant, assistant, user, assistant]` = 4 messages
- Consecutive same-role nodes are aggregated as ONE message
- HIDDEN_ROLES: `system`, `tool`, `thinking` excluded from count

## Project Structure

```
extension/
├── manifest.json          # Symlink → manifest.firefox.json (or chrome/safari copy)
├── manifest.firefox.json  # Firefox-specific manifest
├── manifest.chrome.json   # Chrome-specific manifest
├── manifest.safari.json   # Safari-specific manifest (MV3, no declarativeContent)
└── src/
    ├── page/              # Page script (Fetch Proxy, runs in page context)
    ├── content/           # Content scripts (settings, status bar)
    ├── background/        # Background service worker
    ├── popup/             # Popup HTML/CSS/TS
    └── shared/            # Types, constants, storage, logger
tests/                     # Unit tests (vitest + happy-dom)
build.cjs                  # esbuild build script (supports --target=firefox|chrome|safari)
```

## Conventions

- ES modules (`"type": "module"` in package.json)
- ESLint 9 flat config (`eslint.config.js`)
- Strict TypeScript (`noUncheckedIndexedAccess: true`)
- Prefix logs with `[LS:DEBUG]`, `[LS:INFO]`, `[LS:WARN]`, `[LS:ERROR]`
