# Privacy Policy

**LightSession for ChatGPT** is a privacy-first browser extension. This policy explains what data the extension accesses and how it is handled.

## Data Collection

**We do not collect any data.**

LightSession operates entirely locally in your browser. It does not:

- Collect personal information
- Track your browsing activity
- Send data to external servers
- Use analytics or telemetry
- Store conversation content

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `storage` | Saves your preferences (message limit, UI settings) locally in your browser |
| `tabs` | Detects when you navigate to ChatGPT to apply settings |
| Host permissions (`chatgpt.com`, `chat.openai.com`) | Required to inject the performance optimization script on ChatGPT pages |

## How It Works

LightSession intercepts ChatGPT's API responses **locally in your browser** and trims the conversation data before React renders it. This keeps the UI fast without modifying your actual conversation on OpenAI's servers.

All processing happens entirely within your browser. No data ever leaves your device.

## Third Parties

This extension does not share any data with third parties because it does not collect any data.

## Open Source

LightSession is open source. You can review the code at:
https://github.com/11me/light-session

## Contact

For privacy questions, open an issue on GitHub.

---

*Last updated: January 2026*
