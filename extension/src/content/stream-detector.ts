/**
 * LightSession for ChatGPT - Streaming Detection
 * Detect when ChatGPT is actively generating a response
 */

import { logDebug } from '../shared/logger';

/**
 * Check if ChatGPT is currently streaming a response
 * Looks for progress indicators, typing indicators, and "Stop generating" button
 */
export function isStreaming(root: HTMLElement | null): boolean {
  if (!root) {
    return false;
  }

  // Check for "Stop generating" button
  const stopButton = root.querySelector(
    'button[aria-label*="stop" i], button[title*="stop" i], button:has(svg[data-testid*="stop" i])'
  );
  if (stopButton) {
    logDebug('Streaming detected: Stop button present');
    return true;
  }

  // Check for progress bars or loading indicators
  const progressIndicators = root.querySelectorAll(
    '[role="progressbar"], [aria-busy="true"], [data-testid*="loading" i]'
  );
  if (progressIndicators.length > 0) {
    logDebug('Streaming detected: Progress indicators present');
    return true;
  }

  // Check for typing indicators (animated dots, etc.)
  const typingIndicators = root.querySelectorAll(
    '[class*="typing" i], [class*="loading" i], [class*="generating" i]'
  );
  for (let i = 0; i < typingIndicators.length; i++) {
    const indicator = typingIndicators[i];
    if (indicator instanceof HTMLElement && indicator.offsetParent !== null) {
      logDebug('Streaming detected: Typing indicator visible');
      return true;
    }
  }

  return false;
}
