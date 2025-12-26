/**
 * Unit tests for logger.ts - Debug mode and logging utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setDebugMode,
  isDebugMode,
  logDebug,
  logWarn,
  logError,
  logInfo,
} from '../../extension/src/shared/logger';
import { LOG_PREFIX } from '../../extension/src/shared/constants';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset debug mode to default state
    setDebugMode(false);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  describe('setDebugMode', () => {
    it('should enable debug mode when passed true', () => {
      setDebugMode(true);

      expect(isDebugMode()).toBe(true);
    });

    it('should disable debug mode when passed false', () => {
      setDebugMode(true);
      setDebugMode(false);

      expect(isDebugMode()).toBe(false);
    });

    it('should allow toggling debug mode multiple times', () => {
      setDebugMode(true);
      expect(isDebugMode()).toBe(true);

      setDebugMode(false);
      expect(isDebugMode()).toBe(false);

      setDebugMode(true);
      expect(isDebugMode()).toBe(true);
    });
  });

  describe('isDebugMode', () => {
    it('should return false by default', () => {
      expect(isDebugMode()).toBe(false);
    });

    it('should return current debug mode state', () => {
      setDebugMode(true);
      expect(isDebugMode()).toBe(true);

      setDebugMode(false);
      expect(isDebugMode()).toBe(false);
    });
  });

  describe('logDebug', () => {
    it('should not log when debug mode is disabled', () => {
      setDebugMode(false);

      logDebug('test message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log when debug mode is enabled', () => {
      setDebugMode(true);

      logDebug('test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [DEBUG]`,
        'test message'
      );
    });

    it('should include additional arguments when logging', () => {
      setDebugMode(true);

      logDebug('test message', 'arg1', 42, { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [DEBUG]`,
        'test message',
        'arg1',
        42,
        { key: 'value' }
      );
    });

    it('should handle empty additional arguments', () => {
      setDebugMode(true);

      logDebug('test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [DEBUG]`,
        'test message'
      );
    });

    it('should respect debug mode changes', () => {
      setDebugMode(false);
      logDebug('should not appear');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      setDebugMode(true);
      logDebug('should appear');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [DEBUG]`,
        'should appear'
      );
    });

    it('should handle console.log being undefined gracefully', () => {
      setDebugMode(true);

      // Mock console.log as undefined
      consoleLogSpy.mockRestore();
      const originalLog = console.log;
      // @ts-expect-error - Intentionally setting to undefined for test
      console.log = undefined;

      expect(() => logDebug('test')).not.toThrow();

      // Restore
      console.log = originalLog;
    });
  });

  describe('logInfo', () => {
    it('should always log regardless of debug mode', () => {
      setDebugMode(false);

      logInfo('info message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [INFO]`,
        'info message'
      );
    });

    it('should log when debug mode is enabled', () => {
      setDebugMode(true);

      logInfo('info message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [INFO]`,
        'info message'
      );
    });

    it('should include additional arguments', () => {
      logInfo('info message', 'arg1', 42, { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [INFO]`,
        'info message',
        'arg1',
        42,
        { key: 'value' }
      );
    });

    it('should handle console.log being undefined gracefully', () => {
      consoleLogSpy.mockRestore();
      const originalLog = console.log;
      // @ts-expect-error - Intentionally setting to undefined for test
      console.log = undefined;

      expect(() => logInfo('test')).not.toThrow();

      // Restore
      console.log = originalLog;
    });
  });

  describe('logWarn', () => {
    it('should always log regardless of debug mode', () => {
      setDebugMode(false);

      logWarn('warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [WARN]`,
        'warning message'
      );
    });

    it('should log when debug mode is enabled', () => {
      setDebugMode(true);

      logWarn('warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [WARN]`,
        'warning message'
      );
    });

    it('should include additional arguments', () => {
      logWarn('warning message', 'arg1', 42, { key: 'value' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [WARN]`,
        'warning message',
        'arg1',
        42,
        { key: 'value' }
      );
    });

    it('should handle console.warn being undefined gracefully', () => {
      consoleWarnSpy.mockRestore();
      const originalWarn = console.warn;
      // @ts-expect-error - Intentionally setting to undefined for test
      console.warn = undefined;

      expect(() => logWarn('test')).not.toThrow();

      // Restore
      console.warn = originalWarn;
    });
  });

  describe('logError', () => {
    it('should always log regardless of debug mode', () => {
      setDebugMode(false);

      logError('error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [ERROR]`,
        'error message'
      );
    });

    it('should log when debug mode is enabled', () => {
      setDebugMode(true);

      logError('error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [ERROR]`,
        'error message'
      );
    });

    it('should include additional arguments', () => {
      logError('error message', 'arg1', 42, { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [ERROR]`,
        'error message',
        'arg1',
        42,
        { key: 'value' }
      );
    });

    it('should handle Error objects in arguments', () => {
      const error = new Error('test error');

      logError('operation failed', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [ERROR]`,
        'operation failed',
        error
      );
    });

    it('should handle console.error being undefined gracefully', () => {
      consoleErrorSpy.mockRestore();
      const originalError = console.error;
      // @ts-expect-error - Intentionally setting to undefined for test
      console.error = undefined;

      expect(() => logError('test')).not.toThrow();

      // Restore
      console.error = originalError;
    });
  });

  describe('edge cases', () => {
    it('should handle empty string messages', () => {
      setDebugMode(true);

      logDebug('');
      logInfo('');
      logWarn('');
      logError('');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle special characters in messages', () => {
      setDebugMode(true);

      const specialMessage = 'Test: \n\t"quotes" & <symbols>';

      logDebug(specialMessage);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [DEBUG]`,
        specialMessage
      );
    });

    it('should handle null and undefined in additional arguments', () => {
      setDebugMode(true);

      logDebug('message', null, undefined);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [DEBUG]`,
        'message',
        null,
        undefined
      );
    });

    it('should handle very long messages', () => {
      setDebugMode(true);

      const longMessage = 'x'.repeat(10000);

      logDebug(longMessage);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${LOG_PREFIX} [DEBUG]`,
        longMessage
      );
    });

    it('should handle circular references in objects', () => {
      setDebugMode(true);

      const circular: { self?: unknown } = {};
      circular.self = circular;

      // Should not throw - console.log handles circular refs
      expect(() => logDebug('circular', circular)).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should allow mixing different log levels', () => {
      setDebugMode(true);

      logDebug('debug message');
      logInfo('info message');
      logWarn('warning message');
      logError('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // debug + info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should properly filter debug logs when disabled', () => {
      setDebugMode(false);

      logDebug('debug 1');
      logInfo('info 1');
      logDebug('debug 2');
      logWarn('warn 1');
      logDebug('debug 3');
      logError('error 1');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1); // only info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should maintain state across multiple log calls', () => {
      setDebugMode(true);

      logDebug('first');
      logDebug('second');
      logDebug('third');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        `${LOG_PREFIX} [DEBUG]`,
        'first'
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        2,
        `${LOG_PREFIX} [DEBUG]`,
        'second'
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        3,
        `${LOG_PREFIX} [DEBUG]`,
        'third'
      );
    });
  });
});
