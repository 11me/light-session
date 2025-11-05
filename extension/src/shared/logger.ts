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
  log: (...args: any[]) => {
    try {
      console?.log?.(...args);
    } catch (e) {
      // Silently fail if console is unavailable
    }
  },
  warn: (...args: any[]) => {
    try {
      console?.warn?.(...args);
    } catch (e) {
      // Silently fail if console is unavailable
    }
  },
  error: (...args: any[]) => {
    try {
      console?.error?.(...args);
    } catch (e) {
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
export function logDebug(message: string, ...args: any[]): void {
  if (debugEnabled) {
    safeConsole.log(`${LOG_PREFIX} [DEBUG]`, message, ...args);
  }
}

/**
 * Log warning (always shown)
 */
export function logWarn(message: string, ...args: any[]): void {
  safeConsole.warn(`${LOG_PREFIX} [WARN]`, message, ...args);
}

/**
 * Log error (always shown)
 */
export function logError(message: string, ...args: any[]): void {
  safeConsole.error(`${LOG_PREFIX} [ERROR]`, message, ...args);
}

/**
 * Log info (always shown)
 */
export function logInfo(message: string, ...args: any[]): void {
  safeConsole.log(`${LOG_PREFIX} [INFO]`, message, ...args);
}
