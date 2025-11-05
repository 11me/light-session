#!/usr/bin/env node
/**
 * Build script for LightSession extension
 * Bundles TypeScript → single JS files (no imports) for MV3 compatibility
 */

const esbuild = require('esbuild');
const path = require('path');

async function build() {
  const buildOptions = {
    bundle: true,
    format: 'iife', // Immediately Invoked Function Expression (no imports)
    target: 'es2020',
    sourcemap: true,
    platform: 'browser',
  };

  try {
    // Build background script (service worker)
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/background/background.ts'],
      outfile: 'extension/dist/background.js',
    });
    console.log('✓ Built background script');

    // Build content script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/content/content.ts'],
      outfile: 'extension/dist/content.js',
    });
    console.log('✓ Built content script');

    // Build popup script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['extension/src/popup/popup.ts'],
      outfile: 'extension/popup/popup.js',
    });
    console.log('✓ Built popup script');

    console.log('\n✅ Build complete! Extension ready for Firefox.');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
