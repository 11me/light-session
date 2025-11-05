# Quick Start Guide: LightSession for ChatGPT

**Feature**: 001-lightsession-chatgpt
**Date**: 2025-11-05
**Purpose**: Development environment setup, build workflow, testing, and debugging

## Prerequisites

### Required Software

- **Firefox**: Version 115 or later ([Download](https://www.mozilla.org/firefox/))
- **Firefox Developer Edition** (recommended): For enhanced debugging ([Download](https://www.mozilla.org/firefox/developer/))
- **Node.js**: Version 18.x or later ([Download](https://nodejs.org/))
- **npm**: Version 9.x or later (comes with Node.js)
- **Git**: For version control

### Verify Installation

```bash
# Check Node.js version (should be ≥18.0.0)
node --version

# Check npm version (should be ≥9.0.0)
npm --version

# Check Firefox version (should be ≥115.0)
firefox --version
```

---

## Initial Setup

### 1. Install Development Dependencies

```bash
# From repository root
cd /home/limerc/repos/github.com/11me/light-session

# Initialize package.json if not exists
npm init -y

# Install dev dependencies
npm install --save-dev \
  typescript@^5.3.0 \
  @types/firefox-webext-browser@^120.0.0 \
  web-ext@^7.11.0 \
  eslint@^8.56.0 \
  @typescript-eslint/eslint-plugin@^6.19.0 \
  @typescript-eslint/parser@^6.19.0 \
  prettier@^3.2.0
```

### 2. Create Extension Directory Structure

```bash
# Create directories
mkdir -p extension/{src/{content,background,popup,shared,options},dist,icons}
mkdir -p tests/{manual,fixtures}

# Directory structure should match plan.md § Project Structure
```

### 3. Configure TypeScript

Create `tsconfig.json` in repository root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "lib": ["ES2020", "DOM"],
    "outDir": "extension/dist",
    "rootDir": "extension/src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["firefox-webext-browser"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["extension/src/**/*"],
  "exclude": ["node_modules", "extension/dist", "tests"]
}
```

### 4. Configure ESLint

Create `.eslintrc.json`:

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "env": {
    "browser": true,
    "es2020": true,
    "webextensions": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### 5. Configure Prettier

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always"
}
```

### 6. Create Manifest

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "LightSession for ChatGPT",
  "version": "1.0.0",
  "description": "Keep ChatGPT fast by keeping only the last N messages in the DOM. Local-only.",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_title": "LightSession",
    "default_popup": "popup/popup.html"
  },
  "permissions": ["storage"],
  "host_permissions": [
    "*://chat.openai.com/*",
    "*://chatgpt.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "*://chat.openai.com/*",
        "*://chatgpt.com/*"
      ],
      "js": ["dist/content/content.js"],
      "run_at": "document_end"
    }
  ],
  "background": {
    "scripts": ["dist/background/background.js"]
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "lightsession@example.com",
      "strict_min_version": "115.0"
    }
  }
}
```

**Note**: Replace `lightsession@example.com` with your actual extension ID for AMO submission.

### 7. Add npm Scripts

Update `package.json` scripts section:

```json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "lint": "eslint extension/src --ext .ts",
    "lint:fix": "eslint extension/src --ext .ts --fix",
    "format": "prettier --write 'extension/src/**/*.ts'",
    "format:check": "prettier --check 'extension/src/**/*.ts'",
    "dev": "web-ext run --source-dir=extension --firefox=firefoxdeveloperedition --start-url='https://chat.openai.com'",
    "dev:stable": "web-ext run --source-dir=extension --firefox=firefox --start-url='https://chat.openai.com'",
    "package": "npm run build && web-ext build --source-dir=extension --artifacts-dir=web-ext-artifacts",
    "clean": "rm -rf extension/dist web-ext-artifacts"
  }
}
```

---

## Development Workflow

### Build and Watch

**Initial build**:
```bash
npm run build
```

**Watch mode** (rebuilds on file changes):
```bash
npm run watch
```

### Run in Firefox

**Option 1: Firefox Developer Edition** (recommended):
```bash
npm run dev
```

This will:
- Start Firefox Developer Edition
- Load the extension temporarily
- Open ChatGPT automatically
- Watch for file changes and reload

**Option 2: Stable Firefox**:
```bash
npm run dev:stable
```

### Manual Testing

1. Navigate to a long ChatGPT conversation (100+ messages) or create one
2. Open Firefox DevTools (F12)
3. Go to Console tab
4. Open extension popup (click toolbar icon)
5. Enable debug mode in popup
6. Observe "LS:" prefixed logs in console

**Test Cases** (from `tests/manual/`):
- Long thread test (100+ messages)
- Scroll pause test (scroll up/down behavior)
- System/tool preservation test
- Streaming detection test
- Settings persistence test

### Debugging Techniques

**Content Script Debugging**:
```typescript
// In extension/src/content/content.ts
// Add temporary debug statements
console.log('LS: [DEBUG] collectCandidates returned', candidates.length, 'nodes');
console.log('LS: [DEBUG] Trim evaluation preconditions:', {
  enabled: state.settings.enabled,
  isAtBottom: state.isAtBottom,
  isStreaming: isStreaming(state.conversationRoot),
  candidateCount: nodes.length
});
```

**Background Script Debugging**:
1. Open `about:debugging#/runtime/this-firefox`
2. Find "LightSession for ChatGPT"
3. Click "Inspect" to open dedicated DevTools

**Popup Debugging**:
1. Right-click extension icon
2. Select "Inspect Popup"
3. DevTools opens for popup context

### Memory Profiling

**Heap Snapshot Comparison**:
1. Open long ChatGPT conversation (100+ messages)
2. Open Firefox DevTools → Memory tab
3. Take snapshot #1 (before trimming)
4. Enable extension and trigger trim
5. Take snapshot #2 (after trimming)
6. Compare snapshots: Should see 25-50% reduction in DOM nodes

**Performance Profiling**:
1. Firefox DevTools → Performance tab
2. Start recording
3. Trigger trim operation
4. Stop recording
5. Verify: Main thread blocking < 16ms per batch

---

## Linting and Formatting

### Run Linter

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Format Code

```bash
# Check formatting
npm run format:check

# Auto-format
npm run format
```

### Pre-commit Workflow

Recommended workflow before committing:

```bash
# 1. Format code
npm run format

# 2. Lint and fix
npm run lint:fix

# 3. Build
npm run build

# 4. Test manually in Firefox
npm run dev

# 5. Commit if all pass
git add .
git commit -m "feat: implement X"
```

---

## Testing

### Manual Test Procedures

Located in `tests/manual/`:

1. **long-thread-test.md**: Verify trimming on 100+ message conversations
2. **scroll-pause-test.md**: Verify pause-on-scroll-up behavior
3. **streaming-test.md**: Verify streaming detection and deferral
4. **settings-persistence-test.md**: Verify settings survive restart
5. **system-tool-preservation-test.md**: Verify system/tool message preservation

### Test ChatGPT Conversations

**Create test conversations**:
```bash
# Open ChatGPT and run these prompts to generate messages:
1. "Generate 50 numbered messages (1 to 50)"
2. "Use code interpreter to run: print('test')"  # Creates tool message
3. Request long response: "Write a 1000-word essay on X"
```

---

## Packaging for Distribution

### Build Production Package

```bash
# 1. Clean previous builds
npm run clean

# 2. Build TypeScript
npm run build

# 3. Run linter
npm run lint

# 4. Create signed .xpi
npm run package
```

Output: `web-ext-artifacts/lightsession_for_chatgpt-1.0.0.zip`

### Prepare for AMO Submission

1. **Create icons** (if not exists):
   - Generate 16x16, 32x32, 48x48, 128x128 PNG icons
   - Place in `extension/icons/`

2. **Update manifest**:
   - Increment `version` field
   - Update `description` if needed

3. **Create documentation**:
   - `README.md`: Installation and usage instructions
   - `PRIVACY.md`: Privacy policy (no data collection)
   - Screenshots (3-5 images showing popup and effect)

4. **Submit to AMO**:
   - Go to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)
   - Upload `web-ext-artifacts/*.zip`
   - Fill listing details (description, screenshots, privacy policy)

---

## Common Issues & Solutions

### Issue: `browser` is not defined

**Cause**: Missing `@types/firefox-webext-browser` types
**Solution**:
```bash
npm install --save-dev @types/firefox-webext-browser
```

### Issue: TypeScript cannot find modules

**Cause**: Incorrect `tsconfig.json` paths
**Solution**: Verify `rootDir` and `outDir` in tsconfig.json:
```json
{
  "compilerOptions": {
    "rootDir": "extension/src",
    "outDir": "extension/dist"
  }
}
```

### Issue: Extension doesn't load in Firefox

**Cause**: Syntax error in manifest.json
**Solution**:
1. Validate manifest.json syntax (use JSONLint)
2. Check Firefox console for error messages:
   ```bash
   about:debugging#/runtime/this-firefox
   ```

### Issue: Content script not injecting

**Cause**: Incorrect `matches` pattern or `run_at` timing
**Solution**:
- Verify `host_permissions` includes ChatGPT domains
- Ensure `run_at: "document_end"` in manifest.json
- Check Firefox console for injection errors

### Issue: Storage not persisting

**Cause**: Missing `storage` permission
**Solution**: Verify `permissions: ["storage"]` in manifest.json

---

## Useful Firefox Developer Tools

### Extension Debugging Shortcuts

- **F12**: Open DevTools (content script context)
- **Ctrl+Shift+K** (Cmd+Opt+K on Mac): Browser console (background script logs)
- **about:debugging**: Extension management and inspection
- **about:addons**: Manage installed extensions

### web-ext CLI Tips

**Lint manifest**:
```bash
web-ext lint --source-dir=extension
```

**Run with specific Firefox profile**:
```bash
web-ext run --source-dir=extension --firefox-profile=dev-profile
```

**Preserve profile between runs**:
```bash
web-ext run --source-dir=extension --keep-profile-changes
```

---

## Next Steps

After completing initial setup:

1. **Review contracts**: Read `contracts/*.ts` for API definitions
2. **Implement content script**: Start with `extension/src/content/content.ts`
3. **Follow implementation tasks**: Proceed to `/speckit.tasks` for task breakdown
4. **Refer to research**: Check `research.md` for technology patterns and best practices
5. **Follow constitution**: Ensure compliance with `constitution.md` principles

---

## References

- [Firefox WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [web-ext CLI Documentation](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [ESLint TypeScript Plugin](https://typescript-eslint.io/)
- [Firefox Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

---

**Maintainer**: See plan.md and spec.md for feature details and requirements
**Support**: Check GitHub issues or Firefox DevTools console for debugging
