/**
 * Unit tests for manifest files - Cross-browser compatibility validation
 *
 * These tests ensure that manifest files are correctly configured for each browser:
 * - Firefox: requires background.scripts (array), does NOT support service_worker
 * - Chrome: requires background.service_worker (string), does NOT support scripts
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Load manifest files
const extensionDir = path.resolve(__dirname, '../../extension');
const firefoxManifest = JSON.parse(
  fs.readFileSync(path.join(extensionDir, 'manifest.firefox.json'), 'utf-8')
);
const chromeManifest = JSON.parse(
  fs.readFileSync(path.join(extensionDir, 'manifest.chrome.json'), 'utf-8')
);

describe('Firefox manifest (manifest.firefox.json)', () => {
  it('uses manifest_version 3', () => {
    expect(firefoxManifest.manifest_version).toBe(3);
  });

  it('has background.scripts array (required for Firefox MV3)', () => {
    expect(firefoxManifest.background).toBeDefined();
    expect(firefoxManifest.background.scripts).toBeDefined();
    expect(Array.isArray(firefoxManifest.background.scripts)).toBe(true);
    expect(firefoxManifest.background.scripts.length).toBeGreaterThan(0);
  });

  it('does NOT have background.service_worker (Firefox does not support it)', () => {
    expect(firefoxManifest.background.service_worker).toBeUndefined();
  });

  it('has browser_specific_settings.gecko', () => {
    expect(firefoxManifest.browser_specific_settings).toBeDefined();
    expect(firefoxManifest.browser_specific_settings.gecko).toBeDefined();
    expect(firefoxManifest.browser_specific_settings.gecko.id).toBeDefined();
  });

  it('has required permissions', () => {
    expect(firefoxManifest.permissions).toContain('storage');
    expect(firefoxManifest.permissions).toContain('tabs');
  });

  it('has host_permissions for ChatGPT domains', () => {
    expect(firefoxManifest.host_permissions).toBeDefined();
    const hosts = firefoxManifest.host_permissions.join(' ');
    expect(hosts).toContain('chat.openai.com');
    expect(hosts).toContain('chatgpt.com');
  });

  it('has content_scripts configured', () => {
    expect(firefoxManifest.content_scripts).toBeDefined();
    expect(firefoxManifest.content_scripts.length).toBeGreaterThan(0);
  });

  it('has web_accessible_resources with page-script.js', () => {
    expect(firefoxManifest.web_accessible_resources).toBeDefined();
    const resources = firefoxManifest.web_accessible_resources[0]?.resources || [];
    expect(resources).toContain('dist/page-script.js');
  });
});

describe('Chrome manifest (manifest.chrome.json)', () => {
  it('uses manifest_version 3', () => {
    expect(chromeManifest.manifest_version).toBe(3);
  });

  it('has background.service_worker string (required for Chrome MV3)', () => {
    expect(chromeManifest.background).toBeDefined();
    expect(chromeManifest.background.service_worker).toBeDefined();
    expect(typeof chromeManifest.background.service_worker).toBe('string');
  });

  it('does NOT have background.scripts (Chrome MV3 uses service_worker)', () => {
    expect(chromeManifest.background.scripts).toBeUndefined();
  });

  it('does NOT have browser_specific_settings (Chrome does not support it)', () => {
    expect(chromeManifest.browser_specific_settings).toBeUndefined();
  });

  it('has required permissions', () => {
    expect(chromeManifest.permissions).toContain('storage');
    expect(chromeManifest.permissions).toContain('tabs');
  });

  it('has host_permissions for ChatGPT domains', () => {
    expect(chromeManifest.host_permissions).toBeDefined();
    const hosts = chromeManifest.host_permissions.join(' ');
    expect(hosts).toContain('chat.openai.com');
    expect(hosts).toContain('chatgpt.com');
  });

  it('has content_scripts configured', () => {
    expect(chromeManifest.content_scripts).toBeDefined();
    expect(chromeManifest.content_scripts.length).toBeGreaterThan(0);
  });

  it('has web_accessible_resources with page-script.js', () => {
    expect(chromeManifest.web_accessible_resources).toBeDefined();
    const resources = chromeManifest.web_accessible_resources[0]?.resources || [];
    expect(resources).toContain('dist/page-script.js');
  });
});

describe('manifest consistency', () => {
  it('both manifests have the same version', () => {
    expect(firefoxManifest.version).toBe(chromeManifest.version);
  });

  it('both manifests have the same name', () => {
    expect(firefoxManifest.name).toBe(chromeManifest.name);
  });

  it('both manifests have the same description', () => {
    expect(firefoxManifest.description).toBe(chromeManifest.description);
  });

  it('chrome permissions include firefox permissions (plus chrome-only)', () => {
    const firefoxPerms = new Set(firefoxManifest.permissions);
    const chromePerms = new Set(chromeManifest.permissions);

    for (const perm of firefoxPerms) {
      expect(chromePerms.has(perm)).toBe(true);
    }

    const extraChromePerms = [...chromePerms].filter((perm) => !firefoxPerms.has(perm));
    expect(extraChromePerms.sort()).toEqual(['declarativeContent']);
  });

  it('both manifests have the same host_permissions', () => {
    expect(firefoxManifest.host_permissions.sort()).toEqual(
      chromeManifest.host_permissions.sort()
    );
  });

  it('both manifests target the same background script', () => {
    const firefoxBg = firefoxManifest.background.scripts[0];
    const chromeBg = chromeManifest.background.service_worker;
    expect(firefoxBg).toBe(chromeBg);
  });

  it('both manifests have the same content scripts', () => {
    expect(firefoxManifest.content_scripts.length).toBe(
      chromeManifest.content_scripts.length
    );

    for (let i = 0; i < firefoxManifest.content_scripts.length; i++) {
      expect(firefoxManifest.content_scripts[i].js).toEqual(
        chromeManifest.content_scripts[i].js
      );
      expect(firefoxManifest.content_scripts[i].run_at).toBe(
        chromeManifest.content_scripts[i].run_at
      );
    }
  });

  it('both manifests have the same icons', () => {
    expect(firefoxManifest.icons).toEqual(chromeManifest.icons);
  });
});

describe('background script configuration details', () => {
  it('Firefox background.scripts is an array with one entry', () => {
    expect(firefoxManifest.background.scripts).toHaveLength(1);
    expect(firefoxManifest.background.scripts[0]).toBe('dist/background.js');
  });

  it('Chrome background.service_worker points to background.js', () => {
    expect(chromeManifest.background.service_worker).toBe('dist/background.js');
  });

  it('Firefox does NOT have preferred_environment (removed for compatibility)', () => {
    expect(firefoxManifest.background.preferred_environment).toBeUndefined();
  });
});
