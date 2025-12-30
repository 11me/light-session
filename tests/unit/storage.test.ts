/**
 * Unit tests for storage.ts - Settings validation and persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateSettings,
  loadSettings,
  updateSettings,
  initializeSettings,
  STORAGE_KEY,
} from '../../extension/src/shared/storage';
import { DEFAULT_SETTINGS, VALIDATION } from '../../extension/src/shared/constants';

// Mock logger to avoid console output in tests
vi.mock('../../extension/src/shared/logger', () => ({
  logDebug: vi.fn(),
  logError: vi.fn(),
}));

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

// ============================================================================
// Async Storage Functions Tests (require browser.storage mock)
// ============================================================================

describe('loadSettings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns stored settings when they exist', async () => {
    const storedSettings = {
      enabled: false,
      keep: 25,
      showStatusBar: false,
      debug: true,
    };

    // Mock browser.storage.local.get
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ [STORAGE_KEY]: storedSettings }),
        },
      },
    });

    const result = await loadSettings();

    expect(result.enabled).toBe(false);
    expect(result.keep).toBe(25);
    expect(result.showStatusBar).toBe(false);
    expect(result.debug).toBe(true);
    expect(result.version).toBe(1);
  });

  it('returns default settings when storage is empty', async () => {
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
        },
      },
    });

    const result = await loadSettings();

    expect(result).toEqual(validateSettings({}));
  });

  it('returns default settings when storage.get throws', async () => {
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockRejectedValue(new Error('Storage unavailable')),
        },
      },
    });

    const result = await loadSettings();

    // Should not throw, returns defaults
    expect(result).toEqual(validateSettings({}));
  });

  it('validates and clamps invalid stored values', async () => {
    // Store out-of-range keep value
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ [STORAGE_KEY]: { keep: 9999 } }),
        },
      },
    });

    const result = await loadSettings();

    expect(result.keep).toBe(VALIDATION.MAX_KEEP);
  });
});

describe('updateSettings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merges partial updates with existing settings', async () => {
    const existingSettings = {
      enabled: true,
      keep: 10,
      showStatusBar: true,
      debug: false,
      version: 1,
    };

    const mockSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ [STORAGE_KEY]: existingSettings }),
          set: mockSet,
        },
      },
    });

    await updateSettings({ keep: 30 });

    // Verify set was called with merged settings
    expect(mockSet).toHaveBeenCalledWith({
      [STORAGE_KEY]: expect.objectContaining({
        enabled: true, // preserved
        keep: 30, // updated
        showStatusBar: true, // preserved
        debug: false, // preserved
      }),
    });
  });

  it('validates updated values', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: mockSet,
        },
      },
    });

    await updateSettings({ keep: -100 }); // Invalid, should be clamped

    expect(mockSet).toHaveBeenCalledWith({
      [STORAGE_KEY]: expect.objectContaining({
        keep: VALIDATION.MIN_KEEP, // Clamped
      }),
    });
  });

  it('throws error when storage.set fails', async () => {
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockRejectedValue(new Error('Write failed')),
        },
      },
    });

    await expect(updateSettings({ enabled: false })).rejects.toThrow('Write failed');
  });

  it('handles error in loadSettings during update', async () => {
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockRejectedValue(new Error('Read failed')),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    });

    // Should still work - loadSettings returns defaults on error
    await expect(updateSettings({ enabled: false })).resolves.toBeUndefined();
  });
});

describe('initializeSettings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets default settings when storage is empty', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: mockSet,
        },
      },
    });

    await initializeSettings();

    expect(mockSet).toHaveBeenCalledWith({
      [STORAGE_KEY]: DEFAULT_SETTINGS,
    });
  });

  it('does not overwrite existing settings', async () => {
    const existingSettings = { enabled: false, keep: 50 };
    const mockSet = vi.fn();

    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ [STORAGE_KEY]: existingSettings }),
          set: mockSet,
        },
      },
    });

    await initializeSettings();

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not throw when storage.get fails', async () => {
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockRejectedValue(new Error('Storage error')),
        },
      },
    });

    // Should not throw
    await expect(initializeSettings()).resolves.toBeUndefined();
  });

  it('does not throw when storage.set fails', async () => {
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockRejectedValue(new Error('Write error')),
        },
      },
    });

    // Should not throw (error is logged but swallowed)
    await expect(initializeSettings()).resolves.toBeUndefined();
  });
});
