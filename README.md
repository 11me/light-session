# LightSession for ChatGPT

Keep ChatGPT fast by keeping only the last N messages in the DOM. 100% local, privacy-first Firefox extension.

## Features

- **Automatic Trimming**: Keeps only the last N messages visible (default: 10, range: 1-100)
- **Memory Optimization**: Reduces memory usage by 25-50% on long conversations (100+ messages)
- **Performance**: Maintains 60fps scrolling with <16ms DOM operation batching
- **Intelligent Preservation**: Optionally preserves system and tool messages beyond normal limit
- **Scroll Pause**: Automatically pauses trimming when reviewing older messages
- **Privacy-First**: Zero network requests, all processing happens locally
- **Reversible**: Page refresh restores full conversation history
- **Quick Toggle**: Enable/disable via popup without losing settings

## Installation

### Firefox Add-ons (Recommended)
*Coming soon to addons.mozilla.org*

### Manual Installation (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/11me/light-session.git
   cd light-session
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Firefox:
   - Open Firefox
   - Navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `extension/manifest.json`

## Usage

### Basic Usage

1. Open a long ChatGPT conversation (or create one)
2. Click the LightSession icon in Firefox toolbar
3. Extension is enabled by default - trimming happens automatically
4. Adjust the slider to change how many messages to keep (1-100)

### Settings

- **Extension Enabled**: Toggle trimming on/off
- **Keep last N messages**: Adjust message retention limit (1-100)
- **Preserve system/tool messages**: Keep system/tool messages beyond normal limit
- **Pause when scrolled up**: Stop trimming while reviewing history
- **Debug mode**: Enable console logging for troubleshooting
- **Refresh**: Reload page to restore full conversation history

### Keyboard Accessibility

- All controls are keyboard accessible (Tab/Shift+Tab to navigate)
- Enter/Space to toggle checkboxes and buttons
- Arrow keys to adjust slider

## How It Works

LightSession uses a **non-destructive trimming approach**:

1. **Detection**: Uses multi-tier selector strategy to find message nodes (resilient to UI changes)
2. **Classification**: Identifies message roles (user, assistant, system, tool)
3. **Calculation**: Determines which messages to keep based on settings
4. **Batching**: Removes excess nodes in idle time (<16ms chunks for 60fps)
5. **Markers**: Replaces removed nodes with comment markers for debugging

**Important**: Trimming only affects the *DOM* (what's displayed). The actual conversation data remains on OpenAI's servers. Refreshing the page restores everything.

## Privacy & Security

- **Zero Network Requests**: No data leaves your browser
- **Local Storage Only**: Settings stored in `browser.storage.local`
- **No Telemetry**: No analytics, tracking, or reporting
- **Minimal Permissions**: Only requires `storage` permission
- **Domain Restricted**: Only runs on `chat.openai.com` and `chatgpt.com`
- **Open Source**: All code is auditable

See [PRIVACY.md](PRIVACY.md) for detailed privacy policy.

## Development

### Requirements

- Node.js ≥18.0
- npm ≥9.0
- Firefox ≥115

### Build Commands

```bash
# Install dependencies
npm install

# Build (one-time)
npm run build

# Watch mode (rebuilds on file changes)
npm run watch

# Lint code
npm run lint

# Format code
npm run format

# Run in Firefox Developer Edition
npm run dev

# Run in Firefox stable
npm run dev:stable

# Package for distribution
npm run package

# Clean build artifacts
npm run clean
```

### Project Structure

```
extension/
├── src/
│   ├── content/        # Content scripts (run in ChatGPT pages)
│   ├── background/     # Background script (settings management)
│   ├── popup/          # Popup UI (HTML/CSS/JS)
│   └── shared/         # Shared types, constants, utilities
├── dist/               # Compiled output (TypeScript → JavaScript)
├── icons/              # Extension icons
└── manifest.json       # Firefox extension manifest

specs/                  # Feature specifications and design docs
tests/                  # Manual test procedures
```

### Architecture

- **State Machine**: Trimmer uses IDLE → OBSERVING → PENDING_TRIM → TRIMMING states
- **Multi-Tier Selectors**: A (data attributes) → B (test IDs) → C (structural + heuristics)
- **Debounced Observer**: MutationObserver batches DOM changes (75ms debounce)
- **Idle Callback**: Removes nodes during browser idle time (requestIdleCallback)
- **Fail-Safe**: Minimum 6 message threshold, aborts on uncertainty

## Compatibility

- **Browser**: Firefox ≥115 (Manifest V3 with background.scripts)
- **OS**: Windows, macOS, Linux
- **ChatGPT**: Optimized for current UI (as of 2025), resilient to minor changes

## Known Limitations

- **Firefox Only**: Chrome/Edge not supported (different WebExtensions API)
- **UI Dependency**: Major ChatGPT UI redesigns may require selector updates
- **No Server-Side**: Cannot reduce actual conversation size on OpenAI servers
- **Manual Testing**: No automated test suite (manual testing with Firefox DevTools)

## Troubleshooting

### Extension not trimming messages

1. Check if extension is enabled (popup toggle should be ON/green)
2. Verify you're on ChatGPT (chat.openai.com or chatgpt.com)
3. Ensure conversation has >6 messages (fail-safe threshold)
4. Check if streaming is in progress (trimming pauses during generation)
5. Enable debug mode in popup and check Firefox console (F12)

### Settings not persisting

1. Check Firefox console for storage errors
2. Verify `storage` permission in manifest
3. Try disabling/re-enabling extension

### Performance issues

1. Lower the "Keep last N messages" slider value
2. Enable "Preserve system/tool messages" (may reduce removable nodes)
3. Check Firefox DevTools → Performance tab for profiling

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run linter (`npm run lint`)
5. Format code (`npm run format`)
6. Build successfully (`npm run build`)
7. Test manually in Firefox (`npm run dev`)
8. Commit changes (`git commit -m "feat: add X"`)
9. Push to branch (`git push origin feature/my-feature`)
10. Open a Pull Request

## License

ISC License - see [LICENSE](LICENSE) for details

## Credits

Created as part of the Specify workflow for feature specification and implementation.

## Support

- **Issues**: [GitHub Issues](https://github.com/11me/light-session/issues)
- **Discussions**: [GitHub Discussions](https://github.com/11me/light-session/discussions)

---

**Disclaimer**: This is an unofficial extension not affiliated with OpenAI. Use at your own risk.
