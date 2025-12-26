/**
 * Unit tests for storage.ts - Settings validation
 */

import { describe, it, expect } from 'vitest';
import { validateSettings } from '../../extension/src/shared/storage';
import { DEFAULT_SETTINGS, VALIDATION } from '../../extension/src/shared/constants';

describe('validateSettings', () => {
  it('returns default settings when given empty object', () => {
    const result = validateSettings({});

    expect(result.version).toBe(1);
    expect(result.enabled).toBe(DEFAULT_SETTINGS.enabled);
    expect(result.keep).toBe(DEFAULT_SETTINGS.keep);
    expect(result.showStatusBar).toBe(DEFAULT_SETTINGS.showStatusBar);
    expect(result.debug).toBe(DEFAULT_SETTINGS.debug);
  });

  it('preserves valid settings values', () => {
    const input = {
      enabled: false,
      keep: 20,
      showStatusBar: false,
      debug: true,
    };

    const result = validateSettings(input);

    expect(result.enabled).toBe(false);
    expect(result.keep).toBe(20);
    expect(result.showStatusBar).toBe(false);
    expect(result.debug).toBe(true);
  });

  it('clamps keep value to MIN_KEEP when below minimum', () => {
    const result = validateSettings({ keep: 0 });

    expect(result.keep).toBe(VALIDATION.MIN_KEEP);
  });

  it('clamps keep value to MAX_KEEP when above maximum', () => {
    const result = validateSettings({ keep: 1000 });

    expect(result.keep).toBe(VALIDATION.MAX_KEEP);
  });

  it('handles negative keep values', () => {
    const result = validateSettings({ keep: -10 });

    expect(result.keep).toBe(VALIDATION.MIN_KEEP);
  });

  it('always sets version to 1', () => {
    // Even if input has different version, output should be 1
    const result = validateSettings({ version: 99 } as Partial<typeof DEFAULT_SETTINGS>);

    expect(result.version).toBe(1);
  });

  it('uses defaults for undefined fields', () => {
    const result = validateSettings({ enabled: false });

    expect(result.enabled).toBe(false);
    expect(result.keep).toBe(DEFAULT_SETTINGS.keep);
    expect(result.showStatusBar).toBe(DEFAULT_SETTINGS.showStatusBar);
    expect(result.debug).toBe(DEFAULT_SETTINGS.debug);
  });

  it('handles boundary keep values', () => {
    expect(validateSettings({ keep: VALIDATION.MIN_KEEP }).keep).toBe(VALIDATION.MIN_KEEP);
    expect(validateSettings({ keep: VALIDATION.MAX_KEEP }).keep).toBe(VALIDATION.MAX_KEEP);
  });
});
