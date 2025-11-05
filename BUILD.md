# Build Instructions for LightSession Firefox Extension

## Prerequisites

### Required Software:
- **Node.js**: Version 16.0 or higher
- **npm**: Version 7.0 or higher (comes with Node.js)

### Install Node.js:
- **Linux/macOS**:
  ```bash
  # Using nvm (recommended)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install 16
  nvm use 16
  ```
  Or download from: https://nodejs.org/

- **Verify installation**:
  ```bash
  node --version  # Should show v16.0.0 or higher
  npm --version   # Should show 7.0.0 or higher
  ```

## Build Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`:
- TypeScript compiler
- esbuild (bundler)
- ESLint and Prettier (code quality)
- web-ext (Firefox extension tooling)

### 2. Build the Extension

**For production (recommended for AMO submission):**
```bash
npm run build:prod
```

This command:
- Removes `.dev` file (hides debug UI)
- Compiles TypeScript to JavaScript
- Bundles all code using esbuild
- Outputs to `extension/dist/`

**For development:**
```bash
npm run build
```

### 3. Package for Distribution

```bash
npm run package
```

This command:
- Runs production build
- Creates a `.zip` file in `web-ext-artifacts/`
- Output: `lightsession_for_chatgpt-1.0.0.zip`

## Build Output

After successful build, the following files will be generated in `extension/dist/`:
- `background.js` - Background script
- `background.js.map` - Source map
- `content.js` - Content script
- `content.js.map` - Source map

And in `extension/popup/`:
- `popup.js` - Popup UI script
- `popup.js.map` - Source map

## Verifying the Build

To verify the build matches the submitted code:

```bash
# Clean previous builds
npm run clean

# Fresh build
npm run build:prod

# Check output
ls -lh extension/dist/
ls -lh extension/popup/popup.js
```

The built files should match the submitted `.zip` extension.

## Build Script Details

The build process is controlled by `build.js` which:
1. Uses esbuild to bundle TypeScript files
2. Generates source maps for debugging
3. Outputs ES2020 compatible JavaScript
4. No minification or obfuscation applied
5. Preserves readable code structure

## Development Mode

**Development build** (with debug UI):
```bash
npm run build
npm run dev  # Opens Firefox with extension loaded
```

**Production build** (no debug UI):
```bash
npm run build:prod
npm run package
```

## Troubleshooting

### "Command not found: npm"
- Install Node.js (see Prerequisites)

### Build fails with TypeScript errors
- Run: `npm run build:types` to check type errors
- Fix any reported type issues

### "web-ext" command not found
- Ensure dependencies installed: `npm install`

### Permission denied on build.js
- Run: `chmod +x build.js`

## Clean Build

To start fresh:
```bash
npm run clean    # Removes all build artifacts
rm -rf node_modules  # Remove dependencies
npm install      # Reinstall dependencies
npm run build:prod  # Build from scratch
```

## System Requirements

- **OS**: Linux, macOS, or Windows
- **Disk space**: ~500MB (including node_modules)
- **RAM**: 1GB minimum for build process
- **Build time**: ~5-10 seconds on modern hardware

## Notes for AMO Reviewers

1. All source code is TypeScript (`.ts` files) in `extension/src/`
2. Build tool: esbuild (see `build.js`)
3. No third-party libraries bundled (extension is self-contained)
4. No minification or code obfuscation
5. Source maps included for debugging
6. Build is deterministic and reproducible
