# LightSession for ChatGPT

Keep ChatGPT fast by keeping only the last N messages in the DOM.
Local-only, privacy-first browser extension that fixes UI lag in long conversations.

[![Firefox Add-on](https://img.shields.io/amo/v/lightsession-for-chatgpt?label=Firefox%20Add-on)](https://addons.mozilla.org/en-US/firefox/addon/lightsession-for-chatgpt/)
[![Users](https://img.shields.io/amo/users/lightsession-for-chatgpt)](https://addons.mozilla.org/en-US/firefox/addon/lightsession-for-chatgpt/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Why LightSession?

Long ChatGPT threads are brutal for the browser: the UI keeps every message in the DOM and the tab slowly turns into molasses — scroll becomes choppy, typing lags, devtools crawl.

**LightSession** fixes that by trimming old DOM nodes *on the client side* while keeping the actual conversation intact on OpenAI's side.

- **Fixes UI lag** in long chats
- **Keeps model context intact** (only the DOM is trimmed)
- **100% local** – no servers, no analytics, no tracking

Built after too many coding sessions where a single ChatGPT tab would start eating CPU and turn Firefox into a slideshow.

---

## Who is this for?

- People who keep **very long ChatGPT threads** (100+ messages)
- Developers who use ChatGPT for **debugging, code reviews, or long refactors**
- Anyone whose ChatGPT tab becomes **sluggish after a while** in Firefox

---

## Features

**Performance**

- **Automatic trimming** – keeps only the last _N_ messages visible (configurable range: 1–100 messages)
- **DOM batching** – node removals are batched within the ~16 ms budget for 60 fps scrolling
- **Smart timing** – waits for AI responses to fully finish streaming before trimming

**User experience**

- **Configurable** – choose how many recent messages to keep (1–100)
- **Status indicator** – optional on-page pill showing trim statistics
- **Reversible** – refresh the page to restore the full conversation

**Privacy**

- **Zero network requests** – no data leaves your browser
- **Local settings only** – uses `browser.storage.local` for configuration
- **No telemetry** – no analytics, tracking, or usage reporting
- **Domain-scoped** – runs only on `chat.openai.com` and `chatgpt.com`

---

## Install

### Firefox Add-ons (recommended)

**[Install from AMO](https://addons.mozilla.org/en-US/firefox/addon/lightsession-for-chatgpt/)**

After installation:

1. Open any ChatGPT conversation.
2. Click the LightSession icon in your Firefox toolbar.
3. Make sure the extension is **enabled**.
4. Adjust how many messages to keep if needed.

### Manual install (development)

```bash
git clone https://github.com/11me/light-session.git
cd light-session

# Install dependencies
npm install

# Build the extension
npm run build
```

Then:

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on**.
3. Select `extension/manifest.json`.

---

## Usage

### Basic usage

1. Open a long ChatGPT conversation (or create one).
2. Click the LightSession toolbar icon.
3. Ensure **Extension enabled** is checked. Trimming will now happen automatically.
4. Use the slider to choose how many of the most recent messages to keep (1–100).

When you want to see the full history again:

- Click **Refresh** in the popup, **or**
- Reload the ChatGPT page.

### Settings

- **Extension enabled** – master on/off toggle.
- **Keep last N messages** – how many messages remain visible in the DOM (1–100).
- **Show status bar** – display a floating pill with trim statistics.
- **Refresh** – reloads the page to restore all messages.

### Keyboard accessibility

- Navigate controls with **Tab / Shift+Tab**.
- Toggle checkboxes and buttons with **Enter / Space**.
- Adjust the slider with **arrow keys**.

---

## FAQ

### Does this reduce the model's context?

No. LightSession only trims the **DOM** (what the browser renders), not the data stored by OpenAI.

- The conversation on OpenAI's servers remains intact.
- Reloading the page (or using **Refresh** in the popup) restores the full history.

### Is my data safe?

Yes:

- No external network requests are made by the extension.
- No analytics, tracking, or telemetry.
- Settings are stored locally in `browser.storage.local`.

### What happens if ChatGPT's UI changes?

LightSession uses a multi-tier selector strategy and conservative fallbacks, but a major UI redesign may temporarily break trimming. In that case:

- The extension will simply stop trimming (fail-safe).
- Your conversations will continue to work as usual.
- An update will be released to restore trimming behavior.

---

## How it works (under the hood)

LightSession uses a non-destructive trimming pipeline:

1. **Detection** – finds ChatGPT message nodes with a multi-tier selector system
   (data attributes → test IDs → structural + heuristic fallback).
2. **Classification** – labels nodes as user / assistant / system / tool messages.
3. **Calculation** – determines which messages to keep based on your settings.
4. **Batching** – removes excess nodes in small chunks using `requestIdleCallback` to stay within the frame budget.
5. **Markers** – optionally leaves comment markers in the DOM for debugging.

Trimming only affects what the browser renders. The conversation itself remains on OpenAI's side and is fully recoverable by reloading the page.

---

## Development

### Requirements

- Node.js >= 18
- npm >= 9
- Firefox >= 115

### Scripts

```bash
# Install dependencies
npm install

# Build once
npm run build

# Watch + rebuild on changes
npm run watch

# Lint
npm run lint

# Format
npm run format

# Run in Firefox Developer Edition
npm run dev

# Run in Firefox (stable)
npm run dev:stable

# Package for distribution
npm run package

# Clean build artifacts
npm run clean
```

### Project structure

```
extension/
├── src/
│   ├── content/        # Content scripts (run on ChatGPT pages)
│   ├── background/     # Background script (settings management)
│   ├── popup/          # Popup UI (HTML/CSS/JS)
│   └── shared/         # Shared types, constants, utilities
├── dist/               # Compiled output (TypeScript → JavaScript)
├── icons/              # Extension icons
└── manifest.json       # Firefox extension manifest
```

### Architecture

- **State machine** for the trimmer: `IDLE → OBSERVING → PENDING_TRIM → TRIMMING`
- **Debounced MutationObserver** (~75ms) to batch DOM changes
- **Idle callback** (`requestIdleCallback`) for non-blocking node removal
- **Fail-safe thresholds** (e.g. minimum message count) to avoid over-trimming

---

## Compatibility

- **Browser:** Firefox >= 115 (Manifest V3)
- **OS:** Windows, macOS, Linux
- **ChatGPT:** Optimized for the current UI (2025), resilient to small layout changes

> This repository contains the **Firefox** implementation.
> A separate **Chrome** version is available on the Chrome Web Store.

---

## Contributing

Pull requests are welcome.
For larger changes or new features, please open an issue first to discuss the approach.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Support

- **Issues:** [GitHub Issues](https://github.com/11me/light-session/issues)

If you find this extension useful, you can support ongoing development:

| Currency | Address |
|----------|---------|
| BTC | `bc1qjs07p0qpa2taaje0044yhjry48qps4dseny4kd` |
| ETH | `0x044ffd952D8525bC69E4d5e32267E9a6bac36510` |
| SOL | `9nP1soTcZspCi2K1WWE9N7PkKPMA3eFgsdZ61vrCCKGZ` |

---

**Disclaimer**: This is an unofficial extension not affiliated with OpenAI.
