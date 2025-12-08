/**
 * LightSession for ChatGPT - Logger Utility
 * Centralized logging with debug mode control
 */

import { LOG_PREFIX } from './constants';

let debugEnabled = false;

/**
 * Safe console wrapper that won't throw if console is unavailable
 */
const safeConsole = {
  log: (...args: unknown[]) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console?.log?.(...(args as Parameters<typeof console.log>));
    } catch {
      // Silently fail if console is unavailable
    }
  },
  warn: (...args: unknown[]) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console?.warn?.(...(args as Parameters<typeof console.warn>));
    } catch {
      // Silently fail if console is unavailable
    }
  },
  error: (...args: unknown[]) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console?.error?.(...(args as Parameters<typeof console.error>));
    } catch {
      // Silently fail if console is unavailable
    }
  },
};

/**
 * Set debug mode (controls logDebug output)
 */
export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * Get current debug mode state
 */
export function isDebugMode(): boolean {
  return debugEnabled;
}

/**
 * Log debug message (only if debug mode enabled)
 */
export function logDebug(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    safeConsole.log(`${LOG_PREFIX} [DEBUG]`, message, ...args);
  }
}

/**
 * Log warning (always shown)
 */
export function logWarn(message: string, ...args: unknown[]): void {
  safeConsole.warn(`${LOG_PREFIX} [WARN]`, message, ...args);
}

/**
 * Log error (always shown)
 */
export function logError(message: string, ...args: unknown[]): void {
  safeConsole.error(`${LOG_PREFIX} [ERROR]`, message, ...args);
}

/**
 * Log info (always shown)
 */
export function logInfo(message: string, ...args: unknown[]): void {
  safeConsole.log(`${LOG_PREFIX} [INFO]`, message, ...args);
}
