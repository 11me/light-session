/**
 * LightSession Pro - Browser API Polyfill
 *
 * Cross-browser compatibility layer for WebExtension APIs.
 * - Firefox: uses global `browser` object (Promise-based)
 * - Chrome: uses global `chrome` object (callback-based, but MV3 supports Promises)
 * - Safari: Web Extensions API (browser/chrome); MV3 from Safari 15.4+
 *
 * Modern Chrome (MV3) supports Promise-based APIs similar to Firefox,
 * so we can use `chrome` directly as a drop-in replacement for `browser`.
 *
 * We type the export as `typeof browser` (Firefox types) because:
 * 1. Firefox types are Promise-based (what we use)
 * 2. Chrome MV3 also supports Promise-based APIs
 * 3. This gives us consistent typing across the codebase
 */

// Detect which API is available
// Firefox provides `browser`, Chrome provides `chrome`
// Some Chrome versions also provide `browser` as an alias
const api: typeof browser =
  typeof browser !== 'undefined'
    ? browser
    : (chrome as unknown as typeof browser);

export default api;
