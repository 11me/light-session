#!/usr/bin/env node
/**
 * Build script for LightSession extension
 * Bundles TypeScript → single JS files (no imports) for MV3 compatibility
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

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

const buildOptions = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  platform: 'browser',
};

async function build() {
  try {
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/background/background.ts'],
      outfile: 'extension/dist/background.js',
    });
    console.log('✓ Built background script');

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

    console.log('\n✅ Build complete! Extension ready for Firefox.');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function watch() {
  console.log('👀 Watch mode enabled. Watching for changes...\n');

  const contexts = await Promise.all([
    esbuild.context({
      ...buildOptions,
      entryPoints: ['extension/src/background/background.ts'],
      outfile: 'extension/dist/background.js',
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
  console.log('✅ Initial build complete.\n');

  // Start watching
  for (const ctx of contexts) {
    await ctx.watch();
  }

  // Watch static files manually
  const staticFiles = ['extension/src/popup/popup.html', 'extension/src/popup/popup.css'];
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
