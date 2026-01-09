# Development Guide

## Prerequisites

- Node.js >= 24.10.0 (use [fnm](https://github.com/Schniz/fnm) or check `.node-version`)
- npm >= 10
- Firefox >= 115 (or Firefox Developer Edition)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/11me/light-session.git
cd light-session

# Install dependencies
npm install

# Build the extension
npm run build

# Start development with auto-reload
npm run dev
```

## Project Structure

```
light-session/
├── extension/
│   ├── src/
│   │   ├── content/           # Content scripts (injected into ChatGPT)
│   │   │   ├── content.ts     # Entry point, lifecycle management
│   │   │   ├── trimmer.ts     # Core trimming state machine
│   │   │   ├── status-bar.ts  # On-page status indicator
│   │   │   ├── dom-helpers.ts # DOM traversal utilities
│   │   │   ├── observers.ts   # MutationObserver setup
│   │   │   └── stream-detector.ts
│   │   ├── background/        # Background service worker
│   │   │   └── background.ts  # Settings management, message handling
│   │   ├── popup/             # Extension popup UI
│   │   │   ├── popup.html
│   │   │   ├── popup.css
│   │   │   └── popup.ts
│   │   └── shared/            # Shared code between all contexts
│   │       ├── types.ts       # TypeScript interfaces
│   │       ├── constants.ts   # Configuration constants
│   │       ├── storage.ts     # Settings persistence
│   │       ├── messages.ts    # Runtime messaging
│   │       └── logger.ts      # Debug logging
│   ├── popup/                 # Compiled popup files
│   ├── icons/                 # Extension icons
│   ├── manifest.json          # Firefox extension manifest (MV3)
│   └── .dev                   # Dev mode marker (not committed)
├── docs/                      # Documentation
├── tests/                     # Unit tests (vitest + happy-dom)
├── build.cjs                  # Build script (esbuild, CommonJS)
├── eslint.config.js           # ESLint flat config
├── vitest.config.ts           # Test configuration
├── package.json               # ES module ("type": "module")
└── tsconfig.json
```

## Architecture

### State Machine

The trimmer uses a simplified state machine:

```
IDLE ←→ OBSERVING
```

- **IDLE**: Extension disabled or not initialized
- **OBSERVING**: Watching for DOM changes via MutationObserver

Trimming is controlled by the `trimScheduled` flag rather than dedicated states.
The `evaluateTrim()` function handles the actual trim logic synchronously when called.

### Key Components

| Component | Responsibility |
|-----------|----------------|
| `content.ts` | Entry point, navigation handling, lifecycle |
| `trimmer.ts` | State machine, trim logic, batch execution |
| `status-bar.ts` | Floating pill UI showing trim stats |
| `dom-helpers.ts` | Finding conversation nodes, classification |
| `background.ts` | Settings storage, message routing |

### Data Flow

```
ChatGPT DOM
    │
    ▼
MutationObserver (debounced 75ms)
    │
    ▼
evaluateTrim()
    │
    ├─ Check preconditions (enabled, not streaming, etc.)
    │
    ├─ Build active thread (find message nodes)
    │
    ├─ Calculate overflow (nodes.length - keepCount)
    │
    └─ Execute trim (batched via requestIdleCallback)
         │
         └─ Update status bar
```

## Build System

Uses esbuild for fast TypeScript compilation:

```bash
# Single build
npm run build

# Watch mode (rebuilds on changes)
npm run watch
```

Build outputs:
- `extension/dist/content.js` — Content script bundle
- `extension/dist/background.js` — Background script bundle
- `extension/popup/popup.js` — Popup script bundle
- `extension/popup/popup.html` — Copied from src
- `extension/popup/popup.css` — Copied from src

## Development Workflow

### 1. Enable Dev Mode

Create a `.dev` file to show debug options in the popup:

```bash
touch extension/.dev
```

This file is gitignored and won't be included in releases.

### 2. Load Extension in Firefox

**Option A: Using web-ext (recommended)**

```bash
npm run dev           # Firefox Developer Edition
npm run dev:stable    # Firefox stable
```

This watches for changes and auto-reloads the extension.

**Option B: Manual loading**

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `extension/manifest.json`

### 3. Testing Changes

1. Make code changes
2. Build: `npm run build` (or use watch mode)
3. If using manual loading, click "Reload" in about:debugging
4. Open/refresh a ChatGPT conversation
5. Check the browser console for debug logs (if debug mode enabled)

### 4. Debug Logging

Enable debug mode in the popup to see detailed logs:

```
[LS:DEBUG] evaluateTrim called
[LS:DEBUG] Settings: enabled=true, keep=10
[LS:DEBUG] Building active thread...
[LS:DEBUG] Built thread with 25 nodes
[LS:INFO] Executing trim: Removing 15 nodes (keeping 10)
```

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build once |
| `npm run build:types` | Type check with TypeScript (no emit) |
| `npm run build:prod` | Production build (removes .dev marker) |
| `npm run watch` | Build and watch for changes |
| `npm run dev` | Run in Firefox Developer Edition with auto-reload |
| `npm run dev:stable` | Run in Firefox stable |
| `npm run test` | Run unit tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues automatically |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run package` | Create .xpi for distribution |
| `npm run clean` | Remove build artifacts |

## Settings Schema

Settings are stored in `browser.storage.local` under the key `ls_settings`:

```typescript
interface LsSettings {
  version: 1;           // Schema version for migrations
  enabled: boolean;     // Master toggle
  keep: number;         // Messages to keep (1-100)
  showStatusBar: boolean; // Show on-page indicator
  debug: boolean;       // Enable console logging
}
```

Default values are defined in `shared/constants.ts`.

## Status Bar

The status bar is a floating pill in the bottom-right corner:

- **Green**: Actively trimming (`LightSession · last 10 · 17 trimmed`)
- **Gray**: Waiting or all visible (`LightSession · all 5 visible`)

Position: `bottom: 50px`, `right: 24px`

The accumulated trim count persists during the session and resets on:
- Page refresh
- Navigation to a different chat

## Common Tasks

### Adding a New Setting

1. Add to `LsSettings` interface in `shared/types.ts`
2. Add default value in `shared/constants.ts`
3. Add validation in `shared/storage.ts`
4. Add UI control in `popup/popup.html`
5. Add handler in `popup/popup.ts`
6. Use setting in content script as needed

### Modifying Trim Behavior

Core logic is in `trimmer.ts`:
- `evaluateTrim()` — Main evaluation function
- `calculateKeepCount()` — How many nodes to keep
- `executeTrim()` — Batched DOM removal

### Updating Selectors

If ChatGPT changes their DOM structure, update selectors in:
- `shared/constants.ts` — `SELECTOR_TIERS` array (multi-tier fallback strategy)
- `dom-helpers.ts` — `buildActiveThread()` and selector logic

The extension uses a tiered selector approach:
- **Tier A**: Data attributes (`[data-message-id]`)
- **Tier B**: Test IDs and specific classes
- **Tier C**: Structural fallbacks with heuristics

## Troubleshooting

### Extension not loading

- Check `about:debugging` for errors
- Verify `manifest.json` is valid
- Check browser console for permission errors

### Trimming not working

1. Enable debug mode
2. Check console for `[LS:*]` logs
3. Common issues:
   - Conversation root not found (selector mismatch)
   - Streaming detected (waits for completion)
   - Not enough messages (minimum threshold)

### Status bar not appearing

- Check `showStatusBar` setting is enabled
- Verify content script is running (check console)
- Inspect DOM for `#lightsession-status-bar` element

## Release Process

Releases are automated via GitHub Actions when a tag is pushed:

```bash
# Create and push a release tag
git tag v1.2.3
git push origin v1.2.3
```

The workflow builds both Firefox and Chrome versions, creates a GitHub Release,
and publishes to both browser stores.

### Required GitHub Secrets

The following secrets must be configured in the repository settings:

#### Firefox Add-ons

| Secret | Description |
|--------|-------------|
| `FIREFOX_ADDON_ID` | AMO extension ID (e.g., `lightsession@example.com`) |
| `FIREFOX_API_ISSUER` | JWT issuer from AMO API credentials |
| `FIREFOX_API_SECRET` | JWT secret from AMO API credentials |

#### Chrome Web Store

| Secret | Description |
|--------|-------------|
| `CHROME_EXTENSION_ID` | Chrome extension ID (32-char alphanumeric) |
| `CHROME_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `CHROME_CLIENT_SECRET` | OAuth 2.0 client secret |
| `CHROME_REFRESH_TOKEN` | OAuth 2.0 refresh token for Chrome Web Store API |

### Getting Chrome Web Store Credentials

1. **Create a Google Cloud Project** at [console.cloud.google.com](https://console.cloud.google.com)
2. **Enable the Chrome Web Store API** in the API Library
3. **Create OAuth 2.0 credentials** (Desktop application type)
4. **Get a refresh token** using the OAuth 2.0 flow:
   - Use the client ID/secret to authorize
   - Request scope: `https://www.googleapis.com/auth/chromewebstore`
   - Exchange the authorization code for a refresh token

For detailed instructions, see the [Chrome Web Store API documentation](https://developer.chrome.com/docs/webstore/using_webstore_api/).

### Multi-Browser Build

```bash
# Build for Firefox
npm run build:prod:firefox

# Build for Chrome
npm run build:prod:chrome

# Build both (development)
npm run build:firefox && npm run build:chrome
```

The build system automatically switches between `manifest.firefox.json` and
`manifest.chrome.json` based on the target.
