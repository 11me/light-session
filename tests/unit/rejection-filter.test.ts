import { describe, expect, it } from 'vitest';

import { isLightSessionRejection } from '../../extension/src/content/rejection-filter';

describe('isLightSessionRejection', () => {
  it('returns false for empty/unknown reasons', () => {
    expect(isLightSessionRejection(undefined)).toBe(false);
    expect(isLightSessionRejection(null)).toBe(false);
    expect(isLightSessionRejection(123)).toBe(false);
    expect(isLightSessionRejection({})).toBe(false);
  });

  it('matches when reason string contains LS:', () => {
    expect(isLightSessionRejection('LS: boom')).toBe(true);
  });

  it('does not match LS: in message when extension URL is provided but not present', () => {
    const prefix = 'chrome-extension://abc123/';
    expect(isLightSessionRejection('LS: boom', prefix)).toBe(false);
  });

  it('matches when Error.stack contains the extension base URL', () => {
    const prefix = 'chrome-extension://abc123/';
    const err = new Error('nope');
    // Simulate a stack that points at our bundled content script URL.
    err.stack = `Error: nope\n    at doThing (${prefix}dist/content.js:1:1)`;
    expect(isLightSessionRejection(err, prefix)).toBe(true);
  });

  it('does not match non-LightSession errors by default', () => {
    const err = new Error('Some site error');
    err.stack = `Error: Some site error\n    at foo (https://chatgpt.com/app.js:1:1)`;
    expect(isLightSessionRejection(err)).toBe(false);
  });
});
