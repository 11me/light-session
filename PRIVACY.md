# Privacy Policy - LightSession for ChatGPT

**Last Updated**: 2025-11-05

## Summary

LightSession is a 100% local, privacy-first Firefox extension. **We collect ZERO data**. All processing happens on your device. No network requests, no telemetry, no tracking.

## Data Collection

**We do not collect, store, transmit, or share any user data. Period.**

## Data Storage

### Local Storage Only

The extension stores **only** your settings locally on your device using Firefox's `browser.storage.local` API:

- Extension enabled/disabled state (boolean)
- Message retention limit (number, 1-100)
- Preserve system/tool messages preference (boolean)
- Pause on scroll up preference (boolean)
- Debug mode preference (boolean)

**Size**: <1KB total

**Location**: Firefox profile directory on your device

**Access**: Only this extension can access its storage

**Deletion**: Settings are automatically deleted when you uninstall the extension

### What We Don't Store

- Conversation content
- Message text
- User inputs
- ChatGPT responses
- URLs visited
- Timestamps
- IP addresses
- Device information
- Browser fingerprints
- Analytics data

## Network Activity

**Zero network requests.**

The extension:
- Does NOT connect to any external servers
- Does NOT send data to OpenAI
- Does NOT send data to us or third parties
- Does NOT use any analytics services
- Does NOT use any tracking pixels
- Does NOT use any third-party libraries at runtime

## Permissions

### Required Permissions

1. **`storage`**: Store your settings locally (nothing else)
2. **`host_permissions` for chat.openai.com and chatgpt.com**:
   - Required to inject content script into ChatGPT pages
   - Extension only runs on these two domains
   - No access to other websites

### What We Don't Request

- Tabs (except for refresh button functionality)
- History
- Bookmarks
- Downloads
- Cookies
- Clipboard
- Notifications
- WebRequest (no network interception)
- Identity (no OAuth)

## Data Processing

All data processing happens **locally in your browser**:

1. **DOM Inspection**: Reads message nodes from ChatGPT page to determine which to hide
2. **Role Detection**: Classifies messages (user, assistant, system, tool) using DOM attributes
3. **Trimming**: Replaces excess message nodes with HTML comments (locally, in memory)
4. **State Management**: Tracks trimmer state (observing, trimming, idle) in memory

**Important**: The extension never accesses message *content*. It only counts and removes DOM nodes.

## Third-Party Services

**None.** This extension uses:

- No analytics (Google Analytics, Mixpanel, etc.)
- No error tracking (Sentry, Rollbar, etc.)
- No advertising SDKs
- No social media integrations
- No CDN-hosted resources
- No external fonts or stylesheets

All code runs entirely offline.

## Data Sharing

**We do not share any data with anyone because we don't collect any data.**

## OpenAI's Data

**Important**: This extension does NOT:
- Delete messages from OpenAI's servers
- Modify conversation history on OpenAI
- Interfere with OpenAI's data collection

The extension only affects what's *displayed* in your browser. Your full conversation history remains on OpenAI's servers and is governed by [OpenAI's Privacy Policy](https://openai.com/policies/privacy-policy).

Refreshing the ChatGPT page restores all hidden messages.

## Children's Privacy

This extension does not collect data from anyone, including children under 13 (COPPA) or 16 (GDPR).

## Changes to This Policy

If this privacy policy changes (e.g., to add optional analytics with explicit opt-in), we will:

1. Update this document with a new "Last Updated" date
2. Notify users via extension update notes
3. Require explicit consent before enabling new features

## Your Rights (GDPR/CCPA)

Since we don't collect any data:

- **Right to Access**: Nothing to access
- **Right to Deletion**: Nothing to delete (uninstall removes local settings)
- **Right to Portability**: Settings are stored in standard Firefox storage format
- **Right to Opt-Out**: N/A (no data collection to opt out of)

## Audit & Verification

This extension is **open source**. You can verify our privacy claims by:

1. **Reviewing the source code**: [GitHub Repository](https://github.com/11me/light-session)
2. **Checking network activity**: Use Firefox DevTools → Network tab (you'll see zero requests)
3. **Inspecting storage**: Use Firefox DevTools → Storage tab → Extension Storage
4. **Reviewing manifest permissions**: See `extension/manifest.json`

## Firefox Add-ons Review

This extension will undergo Mozilla's Firefox Add-ons review process, which includes:

- Automated code scanning
- Manual security review
- Privacy policy verification

## Contact

Questions about privacy? Open an issue on [GitHub](https://github.com/11me/light-session/issues).

---

**TL;DR**: We don't collect anything. Everything stays on your device. We can't access your data because we never request it.
