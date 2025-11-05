/**
 * Storage Schema Contract: LightSession for ChatGPT
 *
 * Defines the persistent storage schema for browser.storage.local
 * Source: constitution § 4.1, data-model.md § 1.1
 */

/**
 * User settings persisted across browser sessions
 *
 * @remarks
 * - Stored under single key 'ls_settings' in browser.storage.local
 * - Version field enables future schema migrations
 * - All values validated on read (clamping, type coercion)
 * - Total storage footprint: <1KB
 */
export interface LsSettings {
  /** Schema version (current: 1) */
  version: 1;

  /** Enable/disable automatic trimming */
  enabled: boolean;

  /** Number of messages to retain (clamped to [1, 100]) */
  keep: number;

  /** Preserve system and tool messages beyond keep limit */
  preserveSystem: boolean;

  /** Pause trimming when user scrolls above last message */
  pauseOnScrollUp: boolean;

  /** Enable debug logging to console */
  debug: boolean;
}

/**
 * Default settings applied on first install or validation failure
 */
export const DEFAULT_SETTINGS: Readonly<LsSettings> = {
  version: 1,
  enabled: true,
  keep: 10,
  preserveSystem: true,
  pauseOnScrollUp: true,
  debug: false,
} as const;

/**
 * Storage key constant
 */
export const SETTINGS_KEY = 'ls_settings' as const;

/**
 * Validate and normalize settings from storage
 *
 * @param input - Partial settings object from browser.storage.local
 * @returns Validated settings with defaults applied
 *
 * @remarks
 * - Clamps `keep` to [1, 100] range
 * - Applies defaults for missing fields
 * - Always returns version: 1 (current schema)
 */
export function validateSettings(input: Partial<LsSettings> | null | undefined): LsSettings {
  if (!input || input.version !== 1) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    version: 1,
    enabled: input.enabled ?? DEFAULT_SETTINGS.enabled,
    keep: Math.max(1, Math.min(100, input.keep ?? DEFAULT_SETTINGS.keep)),
    preserveSystem: input.preserveSystem ?? DEFAULT_SETTINGS.preserveSystem,
    pauseOnScrollUp: input.pauseOnScrollUp ?? DEFAULT_SETTINGS.pauseOnScrollUp,
    debug: input.debug ?? DEFAULT_SETTINGS.debug,
  };
}

/**
 * Type guard for LsSettings
 */
export function isLsSettings(value: unknown): value is LsSettings {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    obj.version === 1 &&
    typeof obj.enabled === 'boolean' &&
    typeof obj.keep === 'number' &&
    typeof obj.preserveSystem === 'boolean' &&
    typeof obj.pauseOnScrollUp === 'boolean' &&
    typeof obj.debug === 'boolean'
  );
}
