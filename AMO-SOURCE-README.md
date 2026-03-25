# Source Code — LightSession Pro for ChatGPT

This archive contains the complete source code for the submitted extension version.

## Build Environment

- **Node.js** 24.10.0 (see `.node-version`)
- **npm** (lockfile: `package-lock.json`)

## Reproduce the build

```bash
npm ci
npm run build:prod:firefox
```

This runs `NODE_ENV=production node build.cjs --target=firefox` which uses esbuild to bundle TypeScript source files into single JS files with minification and no sourcemaps.

## Create the Firefox zip

```bash
cd extension
zip -r ../light-session-firefox.zip manifest.json dist/ popup/ icons/ -x "*.map"
```

## Source layout

```
extension/src/       TypeScript source (page scripts, content scripts, popup, shared)
extension/icons/     Extension icons
extension/manifest.firefox.json   Firefox manifest
extension/manifest.chrome.json    Chrome manifest
build.cjs            esbuild build script
tests/               Unit tests (vitest)
```

## No vendored or private dependencies

All dependencies are public npm packages resolved via `package-lock.json`.
