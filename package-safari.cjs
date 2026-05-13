#!/usr/bin/env node
/**
 * Package the built extension as a Safari Web Extension Xcode project.
 *
 * Apple renamed safari-web-extension-converter to safari-web-extension-packager.
 * Prefer the current tool name, but keep the old name as a fallback for older
 * Xcode installs.
 */

const { spawnSync } = require('child_process');

const TOOLS = ['safari-web-extension-packager', 'safari-web-extension-converter'];
const args = [
  'extension',
  '--project-location',
  'web-ext-artifacts/safari',
  '--app-name',
  'LightSession Pro',
  '--bundle-identifier',
  'com.lightsession.pro',
  '--macos-only',
  '--swift',
  '--copy-resources',
  '--no-open',
  '--no-prompt',
  '--force',
];

function findTool() {
  for (const tool of TOOLS) {
    const result = spawnSync('xcrun', ['--find', tool], { stdio: 'ignore' });
    if (result.status === 0) {
      return tool;
    }
  }

  return undefined;
}

const tool = findTool();

if (!tool) {
  console.error(
    'Safari packaging requires full Xcode with safari-web-extension-packager installed.'
  );
  process.exit(1);
}

const result = spawnSync('xcrun', [tool, ...args], { stdio: 'inherit' });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
