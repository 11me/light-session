/**
 * Unit tests for trimmer.ts - Pure functions
 */

import { describe, it, expect } from 'vitest';
import { calculateKeepCount, createInitialState } from '../../extension/src/content/trimmer';
import { DEFAULT_SETTINGS } from '../../extension/src/shared/constants';
import type { LsSettings } from '../../extension/src/shared/types';

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
});
