/**
 * Unit tests for trimmer.ts - Pure functions and state transitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateKeepCount,
  createInitialState,
  shouldExitBootMode,
  markFirstTrimCompleted,
  scheduleTrim,
} from '../../extension/src/content/trimmer';
import { DEFAULT_SETTINGS, TIMING } from '../../extension/src/shared/constants';
import type { LsSettings, TrimmerState } from '../../extension/src/shared/types';

// Mock logger to avoid console output in tests
vi.mock('../../extension/src/shared/logger', () => ({
  logDebug: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

describe('calculateKeepCount', () => {
  it('returns keep value from settings', () => {
    const settings: LsSettings = { ...DEFAULT_SETTINGS, keep: 15 };

    expect(calculateKeepCount(settings)).toBe(15);
  });

  it('handles minimum keep value', () => {
    const settings: LsSettings = { ...DEFAULT_SETTINGS, keep: 1 };

    expect(calculateKeepCount(settings)).toBe(1);
  });

  it('handles maximum keep value', () => {
    const settings: LsSettings = { ...DEFAULT_SETTINGS, keep: 100 };

    expect(calculateKeepCount(settings)).toBe(100);
  });
});

describe('createInitialState', () => {
  it('creates state with IDLE status', () => {
    const state = createInitialState();

    expect(state.current).toBe('IDLE');
  });

  it('creates state with no observer', () => {
    const state = createInitialState();

    expect(state.observer).toBeNull();
  });

  it('creates state with trimScheduled false', () => {
    const state = createInitialState();

    expect(state.trimScheduled).toBe(false);
  });

  it('creates state with lastTrimTime 0', () => {
    const state = createInitialState();

    expect(state.lastTrimTime).toBe(0);
  });

  it('creates state with no conversationRoot', () => {
    const state = createInitialState();

    expect(state.conversationRoot).toBeNull();
  });

  it('creates state with default settings', () => {
    const state = createInitialState();

    expect(state.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('creates state in BOOT mode', () => {
    const state = createInitialState();

    expect(state.trimMode).toBe('BOOT');
  });

  it('creates state with bootStartTime 0', () => {
    const state = createInitialState();

    expect(state.bootStartTime).toBe(0);
  });

  it('resets firstTrimCompleted flag', () => {
    // Mark first trim completed
    markFirstTrimCompleted();

    // Create new state - should reset the flag
    const state = createInitialState();

    // Verify by checking shouldExitBootMode returns false for fresh state
    // (it would return true if firstTrimCompleted was still set)
    const testState: TrimmerState = {
      ...state,
      trimMode: 'BOOT',
      bootStartTime: performance.now(), // Just started
    };

    expect(shouldExitBootMode(testState)).toBe(false);
  });
});

describe('shouldExitBootMode', () => {
  beforeEach(() => {
    // Reset state before each test
    createInitialState();
  });

  it('returns false when not in BOOT mode', () => {
    const state: TrimmerState = {
      ...createInitialState(),
      trimMode: 'STEADY',
    };

    expect(shouldExitBootMode(state)).toBe(false);
  });

  it('returns false when in BOOT mode and duration not elapsed', () => {
    const state: TrimmerState = {
      ...createInitialState(),
      trimMode: 'BOOT',
      bootStartTime: performance.now(), // Just started
    };

    expect(shouldExitBootMode(state)).toBe(false);
  });

  it('returns true when BOOT duration has elapsed', () => {
    const state: TrimmerState = {
      ...createInitialState(),
      trimMode: 'BOOT',
      bootStartTime: performance.now() - TIMING.BOOT_DURATION_MS - 100, // Elapsed
    };

    expect(shouldExitBootMode(state)).toBe(true);
  });

  it('returns true when first trim completed (early exit)', () => {
    // Reset first
    createInitialState();

    const state: TrimmerState = {
      ...createInitialState(),
      trimMode: 'BOOT',
      bootStartTime: performance.now(), // Just started, but...
    };

    // Mark first trim completed
    markFirstTrimCompleted();

    // Should exit early even though duration hasn't elapsed
    expect(shouldExitBootMode(state)).toBe(true);
  });
});

describe('markFirstTrimCompleted', () => {
  beforeEach(() => {
    // Reset state before each test
    createInitialState();
  });

  it('triggers early BOOT exit', () => {
    const state: TrimmerState = {
      ...createInitialState(),
      trimMode: 'BOOT',
      bootStartTime: performance.now(),
    };

    // Before marking
    expect(shouldExitBootMode(state)).toBe(false);

    // Mark completed
    markFirstTrimCompleted();

    // After marking
    expect(shouldExitBootMode(state)).toBe(true);
  });

  it('is idempotent (multiple calls do not error)', () => {
    markFirstTrimCompleted();
    markFirstTrimCompleted();
    markFirstTrimCompleted();

    // Should not throw
    expect(true).toBe(true);
  });
});

describe('scheduleTrim', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createInitialState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns unchanged state if disabled', () => {
    const state: TrimmerState = {
      ...createInitialState(),
      settings: { ...DEFAULT_SETTINGS, enabled: false },
    };

    const callback = vi.fn();
    const result = scheduleTrim(state, callback);

    expect(result).toEqual(state);
    expect(callback).not.toHaveBeenCalled();
  });

  it('returns unchanged state if already scheduled', () => {
    const state: TrimmerState = {
      ...createInitialState(),
      trimScheduled: true,
    };

    const callback = vi.fn();
    const result = scheduleTrim(state, callback);

    expect(result).toEqual(state);
    expect(callback).not.toHaveBeenCalled();
  });

  it('sets trimScheduled to true when scheduling', () => {
    const state: TrimmerState = {
      ...createInitialState(),
      settings: { ...DEFAULT_SETTINGS, enabled: true },
      trimScheduled: false,
    };

    const callback = vi.fn();
    const result = scheduleTrim(state, callback);

    expect(result.trimScheduled).toBe(true);
  });

  it('calls onComplete callback even if evaluateTrimCallback throws', async () => {
    const state: TrimmerState = {
      ...createInitialState(),
      trimMode: 'STEADY',
      settings: { ...DEFAULT_SETTINGS, enabled: true },
      trimScheduled: false,
    };

    const errorCallback = vi.fn(() => {
      throw new Error('Test error');
    });
    const onComplete = vi.fn();

    scheduleTrim(state, errorCallback, onComplete);

    // Advance timers to trigger the setTimeout
    await vi.advanceTimersByTimeAsync(TIMING.DEBOUNCE_MS + 10);

    expect(errorCallback).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it('uses microtask in BOOT mode for instant execution', async () => {
    const state: TrimmerState = {
      ...createInitialState(),
      trimMode: 'BOOT',
      settings: { ...DEFAULT_SETTINGS, enabled: true },
      trimScheduled: false,
    };

    const callback = vi.fn();
    scheduleTrim(state, callback);

    // Flush microtasks directly (more reliable than fake timers for queueMicrotask)
    await Promise.resolve();

    expect(callback).toHaveBeenCalled();
  });

  it('uses setTimeout in STEADY mode with debounce', async () => {
    const state: TrimmerState = {
      ...createInitialState(),
      trimMode: 'STEADY',
      settings: { ...DEFAULT_SETTINGS, enabled: true },
      trimScheduled: false,
    };

    const callback = vi.fn();
    scheduleTrim(state, callback);

    // Should not be called immediately
    expect(callback).not.toHaveBeenCalled();

    // Advance past debounce time
    await vi.advanceTimersByTimeAsync(TIMING.DEBOUNCE_MS + 10);

    expect(callback).toHaveBeenCalled();
  });
});
