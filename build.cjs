#!/usr/bin/env node
/**
 * Build script for LightSession Pro extension
 * Bundles TypeScript → single JS files (no imports) for MV3 compatibility
 *
 * Usage:
 *   node build.cjs                     - Development build for Firefox (default)
 *   node build.cjs --target=firefox    - Build for Firefox
 *   node build.cjs --target=chrome     - Build for Chrome
 *   node build.cjs --watch             - Watch mode for development
 *   NODE_ENV=production node build.cjs - Production build (minified, no sourcemaps)
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const isProduction = process.env.NODE_ENV === 'production';

// Parse --target=firefox|chrome (default: firefox)
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : 'firefox';
const validTargets = ['firefox', 'chrome'];
if (!validTargets.includes(target)) {
  console.error(`❌ Invalid target: ${target}. Use: ${validTargets.join(', ')}`);
  process.exit(1);
}

/**
 * Copy manifest for target browser
 */
function copyManifest() {
  const manifestSrc = `extension/manifest.${target}.json`;
  const manifestDest = 'extension/manifest.json';

  // Always remove existing manifest.json first
  if (fs.existsSync(manifestDest)) {
    fs.unlinkSync(manifestDest);
  }

  if (target === 'chrome') {
    // For Chrome, copy manifest.chrome.json
    fs.copyFileSync(manifestSrc, manifestDest);
    console.log(`✓ Copied manifest.${target}.json → manifest.json`);
  } else {
    // For Firefox, create symlink to manifest.firefox.json
    fs.symlinkSync('manifest.firefox.json', manifestDest);
    console.log('✓ Created symlink manifest.json → manifest.firefox.json');
  }
}

/**
 * Copy static files from src to extension folder
 */
function copyStaticFiles() {
  const filesToCopy = [
    { src: 'extension/src/popup/popup.html', dest: 'extension/popup/popup.html' },
    { src: 'extension/src/popup/popup.css', dest: 'extension/popup/popup.css' },
  ];

  for (const { src, dest } of filesToCopy) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
  console.log('✓ Copied static files (popup.html, popup.css)');
}

/**
 * Create or remove .dev marker file for development mode detection.
 * The popup checks for this file to show/hide debug options.
 */
function handleDevMarker() {
  const devMarkerPath = 'extension/.dev';

  if (isProduction) {
    // Remove .dev marker in production
    if (fs.existsSync(devMarkerPath)) {
      fs.unlinkSync(devMarkerPath);
      console.log('✓ Removed .dev marker (production build)');
    }
  } else {
    // Create .dev marker in development
    fs.writeFileSync(devMarkerPath, 'Development build marker\n');
    console.log('✓ Created .dev marker (development build)');
  }
}

const buildOptions = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  // Production: minify and no sourcemaps
  // Development: no minification, with sourcemaps for debugging
  minify: isProduction,
  sourcemap: !isProduction,
  // Drop console.log and debugger in production for smaller bundle
  drop: isProduction ? ['debugger'] : [],
  // Define build mode for conditional code
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
  },
};

async function build() {
  const mode = isProduction ? 'production' : 'development';
  console.log(`🔧 Building for ${target.toUpperCase()} in ${mode} mode${isProduction ? ' (minified)' : ' (with sourcemaps)'}...\n`);

  try {
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/background/background.ts'],
      outfile: 'extension/dist/background.js',
    });
    console.log('✓ Built background script');

    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/page/page-script.ts'],
      outfile: 'extension/dist/page-script.js',
    });
    console.log('✓ Built page-script (fetch proxy)');

    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/content/page-inject.ts'],
      outfile: 'extension/dist/page-inject.js',
    });
    console.log('✓ Built page-inject script');

    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/content/content.ts'],
      outfile: 'extension/dist/content.js',
    });
    console.log('✓ Built content script');

    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/popup/popup.ts'],
      outfile: 'extension/popup/popup.js',
    });
    console.log('✓ Built popup script');

    copyStaticFiles();
    copyManifest();
    handleDevMarker();

    console.log(`\n✅ ${mode.charAt(0).toUpperCase() + mode.slice(1)} build complete! Extension ready for ${target.charAt(0).toUpperCase() + target.slice(1)}.`);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function watch() {
  console.log(`👀 Watch mode enabled for ${target.toUpperCase()}. Watching for changes...\n`);

  const contexts = await Promise.all([
    esbuild.context({
      ...buildOptions,
      entryPoints: ['extension/src/background/background.ts'],
      outfile: 'extension/dist/background.js',
    }),
    esbuild.context({
      ...buildOptions,
      entryPoints: ['extension/src/page/page-script.ts'],
      outfile: 'extension/dist/page-script.js',
    }),
    esbuild.context({
      ...buildOptions,
      entryPoints: ['extension/src/content/page-inject.ts'],
      outfile: 'extension/dist/page-inject.js',
    }),
    esbuild.context({
      ...buildOptions,
      entryPoints: ['extension/src/content/content.ts'],
      outfile: 'extension/dist/content.js',
    }),
    esbuild.context({
      ...buildOptions,
      entryPoints: ['extension/src/popup/popup.ts'],
      outfile: 'extension/popup/popup.js',
    }),
  ]);

  // Initial build
  for (const ctx of contexts) {
    await ctx.rebuild();
  }
  copyStaticFiles();
  copyManifest();
  handleDevMarker();
  console.log(`✅ Initial build complete for ${target.toUpperCase()}.\n`);

  // Start watching
  for (const ctx of contexts) {
    await ctx.watch();
  }

  // Watch static files manually
  const staticFiles = [
    'extension/src/popup/popup.html',
    'extension/src/popup/popup.css',
  ];
  for (const file of staticFiles) {
    fs.watchFile(file, { interval: 500 }, () => {
      console.log(`📄 ${path.basename(file)} changed`);
      copyStaticFiles();
    });
  }

  console.log('Watching for changes... (Ctrl+C to stop)\n');
}

if (isWatch) {
  watch();
} else {
  build();
}
