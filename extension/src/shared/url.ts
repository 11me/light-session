/**
 * URL helpers shared across extension components.
 */

const CHATGPT_HOSTS = new Set(['chat.openai.com', 'chatgpt.com']);

export function isChatGptUrl(url?: string | null): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return CHATGPT_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
