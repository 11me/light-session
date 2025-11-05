# Publishing to Firefox Add-ons (AMO)

## Prerequisites

1. Firefox Account: https://accounts.firefox.com/
2. Developer Hub access: https://addons.mozilla.org/developers/

## Step-by-Step Publication Process

### 1. Prepare Production Build

```bash
# Create production package (automatically removes .dev file)
npm run package

# Package will be created at:
# web-ext-artifacts/lightsession_for_chatgpt-1.0.0.zip
```

### 2. Prepare Assets

#### Required:
- ✅ Extension package (.zip) - Created by npm run package
- ✅ Icons (already in extension/icons/)
- 📸 Screenshots (2-5 images, 1280x800 or similar)
- 📝 Description (short and full)

#### Screenshots to capture:
1. Popup UI showing settings (toggle + slider)
2. ChatGPT page with extension working
3. Before/After comparison (optional)

**How to take screenshots:**
1. Load extension in Firefox
2. Open popup or ChatGPT page
3. Press F12 → Console → Responsive Design Mode (Ctrl+Shift+M)
4. Set viewport to 1280x800
5. Take screenshot (Firefox's built-in screenshot tool)

### 3. Submit to AMO

#### Go to Developer Hub:
https://addons.mozilla.org/developers/addon/submit/distribution

#### Select Distribution:
- **On addons.mozilla.org** (recommended for public distribution)
  - Listed: Appears in search results
  - Unlisted: Only accessible via direct link

#### Upload Package:
- Upload: `web-ext-artifacts/lightsession_for_chatgpt-1.0.0.zip`
- Source code: Not required for this extension (no minification/obfuscation)

#### Fill Extension Details:

**Name:**
```
LightSession for ChatGPT
```

**Summary (250 chars max):**
```
Optimize ChatGPT performance by keeping only the last N messages in the DOM. Speeds up long conversations. Privacy-focused, local-only, no data collection.
```

**Description:**
```markdown
# LightSession for ChatGPT

Keep your ChatGPT conversations fast and responsive by automatically managing message history in the DOM.

## Features

- 🚀 **Performance Boost**: Removes old messages from DOM while keeping conversation intact
- 🎛️ **Customizable**: Keep 1-100 of the most recent messages
- 🔒 **Privacy-First**: 100% local processing, no data leaves your browser
- 🔄 **Smart Trimming**: Pauses when you scroll up to review history
- 💬 **Stream-Aware**: Waits for AI responses to complete before trimming

## How It Works

LightSession monitors your ChatGPT conversations and automatically removes old messages from the page's DOM (Document Object Model) while keeping the most recent messages visible. This dramatically improves browser performance during long conversations.

The removed messages aren't deleted from ChatGPT - they're just hidden from your browser's DOM. Refresh the page to see full history again.

## Privacy

- ✅ No data collection
- ✅ No external connections
- ✅ No tracking or analytics
- ✅ Open source
- ✅ All processing happens locally in your browser

## Usage

1. Click the extension icon in your toolbar
2. Toggle "Extension Enabled" on
3. Adjust how many messages to keep (default: 10)
4. Browse ChatGPT normally - trimming happens automatically

To restore full conversation history, click "Refresh" button in the popup or reload the page.

## Compatible With

- chat.openai.com
- chatgpt.com

## Technical Details

- Efficient DOM manipulation (stays within 16ms budget for 60fps)
- Multi-tier selector system for UI resilience
- Automatic preservation of system messages
- Batched removal using requestIdleCallback

## Support

Found a bug or have a suggestion? Visit our GitHub repository.
```

**Categories:**
- Privacy & Security
- Productivity

**Tags:**
```
chatgpt, performance, optimization, dom, privacy
```

**Support Email:**
```
osmium760@gmail.com
```

**Support Website (optional):**
```
https://github.com/11me/light-session
```

**License:**
- Choose license (e.g., MIT, ISC, etc.)

**Privacy Policy:**
```
https://github.com/11me/light-session/blob/main/PRIVACY.md
```

### 4. Review Process

After submission:

1. **Automated Validation** (instant)
   - Checks manifest syntax
   - Scans for security issues
   - Validates permissions

2. **Human Review** (1-7 days typically)
   - Mozilla reviewers test the extension
   - Check for policy compliance
   - Verify functionality

3. **Publication**
   - Once approved, extension goes live
   - You'll receive email notification

### 5. Post-Publication

#### Monitor Reviews:
- Respond to user feedback
- Fix reported bugs

#### Update Extension:
```bash
# Update version in manifest.json
# Make changes
npm run package

# Upload new version at:
# https://addons.mozilla.org/developers/addon/lightsession-for-chatgpt/versions
```

## Approval Checklist

Before submitting, verify:

- [ ] manifest.json has correct version
- [ ] No .dev file in package
- [ ] All debug code removed/disabled
- [ ] Icons are present and correct
- [ ] Description is clear and complete
- [ ] Screenshots show actual functionality
- [ ] Privacy policy is accessible
- [ ] Support contact provided
- [ ] Extension tested in clean Firefox profile
- [ ] No console errors in production build

## Common Rejection Reasons

❌ **Avoid:**
- Using minified/obfuscated code without source
- Requesting unnecessary permissions
- Unclear privacy policy
- Misleading descriptions
- Poor quality screenshots
- Analytics without clear disclosure

## Testing Before Submission

Test in clean Firefox profile:

```bash
# Create temporary Firefox profile for testing
firefox -profile /tmp/test-profile

# Load extension temporarily:
# about:debugging → This Firefox → Load Temporary Add-on
# Select: web-ext-artifacts/lightsession_for_chatgpt-1.0.0.zip
```

## Resources

- Developer Hub: https://addons.mozilla.org/developers/
- Submission Guide: https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- Review Policies: https://extensionworkshop.com/documentation/publish/add-on-policies/
- Extension Best Practices: https://extensionworkshop.com/documentation/develop/best-practices-for-updates/

## Quick Links

- **Submit New Extension:** https://addons.mozilla.org/developers/addon/submit/
- **Manage Extensions:** https://addons.mozilla.org/developers/addons
- **Extension Statistics:** Available after publication in Developer Hub
