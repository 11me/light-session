/**
 * Helpers for filtering global error events so we don't suppress site errors.
 *
 * The content script can observe `window` errors/rejections originating from the page.
 * Calling `preventDefault()` on these events suppresses the browser's default reporting,
 * so we must only suppress errors that are clearly caused by LightSession itself.
 */

export function isLightSessionRejection(
  reason: unknown,
  extensionUrlPrefix?: string,
): boolean {
  const parts: string[] = [];

  if (typeof reason === 'string') {
    parts.push(reason);
  } else if (reason instanceof Error) {
    if (typeof reason.message === 'string') parts.push(reason.message);
    if (typeof reason.stack === 'string') parts.push(reason.stack);
    if (typeof reason.name === 'string') parts.push(reason.name);
  } else if (typeof reason === 'object' && reason !== null) {
    const r = reason as Record<string, unknown>;
    if (typeof r.message === 'string') parts.push(r.message);
    if (typeof r.stack === 'string') parts.push(r.stack);
    if (typeof r.name === 'string') parts.push(r.name);
    // Some browsers use different keys on Error-like objects.
    if (typeof r.filename === 'string') parts.push(r.filename);
    if (typeof r.fileName === 'string') parts.push(r.fileName);
  }

  if (parts.length === 0) return false;

  const haystack = parts.join('\n');

  // The most reliable signal: our own extension base URL.
  // If we have it, prefer it exclusively to avoid suppressing unrelated site errors.
  if (extensionUrlPrefix) {
    return haystack.includes(extensionUrlPrefix);
  }

  // Fallback heuristics (only used if runtime URL isn't available).
  // Our logger prefix sometimes appears in thrown messages.
  if (haystack.includes('LS:')) return true;

  // Useful in dev builds / source maps.
  if (haystack.includes('light-session')) return true;

  return false;
}
