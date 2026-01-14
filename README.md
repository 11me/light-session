# ⚡ LightSession for ChatGPT

Keep ChatGPT fast by keeping only the last N messages in the DOM.
Local-only, privacy-first browser extension that fixes UI lag in long conversations.

[![Firefox Add-on](https://img.shields.io/amo/v/lightsession-for-chatgpt?label=Firefox%20Add-on)](https://addons.mozilla.org/en-US/firefox/addon/lightsession-for-chatgpt/)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/fhloegjhggnokmkboompifoabpbcplgd?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/lightsession-pro-for-chat/fhloegjhggnokmkboompifoabpbcplgd)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🤔 Why LightSession?

Long ChatGPT threads are brutal for the browser: the UI keeps every message in the DOM and the tab slowly turns into molasses — scroll becomes choppy, typing lags, devtools crawl.

**LightSession** fixes that by intercepting API responses and trimming conversation data *before* React renders it, keeping the actual conversation intact on OpenAI's side.

- **Fixes UI lag** in long chats
- **Keeps model context intact** (only the DOM is trimmed)
- **100% local** – no servers, no analytics, no tracking

Built after too many coding sessions where a single ChatGPT tab would start eating CPU and turn the browser into a slideshow.

---

## 🎯 Who is this for?

- People who keep **very long ChatGPT threads** (100+ messages)
- Developers who use ChatGPT for **debugging, code reviews, or long refactors**
- Anyone whose ChatGPT tab becomes **sluggish after a while**

---

## ✨ Features

**Performance**

- **Fetch Proxy** – intercepts API responses and trims JSON before React renders (no flash of untrimmed content)
- **Message-based counting** – counts conversation messages (aggregated by role), not individual nodes, for accurate limits
- **Automatic trimming** – keeps only the last _N_ messages visible (configurable range: 1–100)
- **Ultra Lean Mode** _(Experimental)_ – aggressive CSS optimizations: kills animations, applies containment

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

## 📦 Install

### Firefox

**[Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/lightsession-for-chatgpt/)**

### Chrome

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/lightsession-pro-for-chat/fhloegjhggnokmkboompifoabpbcplgd)**

### After installation

1. Open any ChatGPT conversation.
2. Click the LightSession icon in your browser toolbar.
3. Make sure the extension is **enabled**.
4. Adjust how many messages to keep if needed.

### Manual install (development)

```bash
git clone https://github.com/11me/light-session.git
cd light-session
npm install

# Build for Firefox
npm run build:firefox

# Build for Chrome
npm run build:chrome
```

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `extension/manifest.json`

**Chrome:**
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder

---

## 🚀 Usage

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
- **Ultra Lean Mode** – aggressive performance mode for very long/laggy chats (experimental).
- **Refresh** – reloads the page to restore all messages.

### Keyboard accessibility

- Navigate controls with **Tab / Shift+Tab**.
- Toggle checkboxes and buttons with **Enter / Space**.
- Adjust the slider with **arrow keys**.

---

## ❓ FAQ

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

## 🔧 How it works

LightSession uses a **Fetch Proxy** architecture:

1. **Injection** – at `document_start`, injects a script into the page context before ChatGPT loads.
2. **Interception** – patches `window.fetch` to intercept `/backend-api/` JSON responses.
3. **Trimming** – parses the conversation mapping, counts messages (role transitions), keeps the last N messages.
4. **Response** – returns a modified Response with trimmed JSON; React renders only kept messages.

**Message counting**: A "message" is a contiguous sequence of nodes from the same role. Consecutive assistant nodes (e.g., from Extended Thinking) are aggregated as ONE message.

Trimming only affects what the browser renders. The conversation itself remains on OpenAI's side and is fully recoverable by reloading the page.

---

## 🛠️ Development

### Requirements

- Node.js >= 24.10.0 (see `.node-version`)
- npm >= 10
- Firefox >= 115 or Chrome >= 120

### Scripts

```bash
npm install              # Install dependencies

# Build
npm run build            # Build for Firefox (default)
npm run build:firefox    # Build for Firefox
npm run build:chrome     # Build for Chrome

# Development
npm run dev              # Run in Firefox Developer Edition
npm run watch:chrome     # Watch mode for Chrome

# Quality
npm run test             # Run tests
npm run lint             # Lint
npm run build:types      # Type check

# Package
npm run package          # Package for Firefox (web-ext-artifacts/)
npm run package:chrome   # Package for Chrome (ZIP)
```

### Project structure

```
extension/
├── src/
│   ├── content/        # Content scripts (settings dispatch, status bar)
│   ├── page/           # Page script (Fetch Proxy, runs in page context)
│   ├── background/     # Background service worker
│   ├── popup/          # Popup UI (HTML/CSS/JS)
│   └── shared/         # Shared types, constants, utilities
├── dist/               # Compiled output (TypeScript → JavaScript)
├── icons/              # Extension icons
├── manifest.firefox.json  # Firefox manifest (MV3)
├── manifest.chrome.json   # Chrome manifest (MV3)
└── manifest.json          # Active manifest (symlink/copy from build)
```

### Architecture

- **Fetch Proxy** – patches `window.fetch` in page context to intercept API responses
- **Message-based trimming** – counts role transitions (aggregated messages), not individual nodes
- **Content ↔ Page communication** – CustomEvents for settings dispatch and status updates
- **HIDDEN_ROLES** – system, tool, thinking nodes excluded from message count

---

## 🌐 Compatibility

- **Browsers:** Firefox >= 115, Chrome >= 120 (Manifest V3)
- **OS:** Windows, macOS, Linux
- **ChatGPT:** Optimized for the current UI (2025), resilient to small layout changes

---

## 🤝 Contributing

Pull requests are welcome.
For larger changes or new features, please open an issue first to discuss the approach.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## ❤️ Support

- **Issues:** [GitHub Issues](https://github.com/11me/light-session/issues)

If you find this extension useful, you can support ongoing development:

| Currency | Address |
|----------|---------|
| BTC | `bc1qjs07p0qpa2taaje0044yhjry48qps4dseny4kd` |
| ETH | `0x044ffd952D8525bC69E4d5e32267E9a6bac36510` |
| SOL | `9nP1soTcZspCi2K1WWE9N7PkKPMA3eFgsdZ61vrCCKGZ` |

---

**Disclaimer**: This is an unofficial extension not affiliated with OpenAI.
