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

export function extractConversationPageId(url?: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (!CHATGPT_HOSTS.has(parsed.hostname)) {
      return null;
    }

    const match = parsed.pathname.match(/^\/c\/([^/]+)\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
