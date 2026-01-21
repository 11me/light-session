/**
 * LightSession Pro - Action icon state
 * Enable the action only on ChatGPT sites.
 */

import browser from '../shared/browser-polyfill';
import { isChatGptUrl } from '../shared/url';

const DEFAULT_POPUP = browser.runtime.getManifest().action?.default_popup ?? 'popup/popup.html';
const CHATGPT_RULES = [
  { hostEquals: 'chatgpt.com' },
  { hostEquals: 'chat.openai.com' },
];

function setPopupForTab(tabId: number, popup: string): void {
  if (!browser.action) {
    return;
  }

  try {
    void browser.action.setPopup({ tabId, popup });
  } catch {
    // Ignore action update failures (e.g., restricted tabs)
  }
}

export function updateActionForTab(tabId: number, url?: string | null): void {
  if (!browser.action || !tabId) {
    return;
  }

  try {
    if (isChatGptUrl(url)) {
      void browser.action.enable(tabId);
      setPopupForTab(tabId, DEFAULT_POPUP);
    } else {
      void browser.action.disable(tabId);
      setPopupForTab(tabId, '');
    }
  } catch {
    // Ignore action update failures (e.g., restricted tabs)
  }
}

export function disableActionByDefault(): void {
  if (!browser.action) {
    return;
  }

  try {
    void browser.action.disable();
    void browser.action.setPopup({ popup: '' });
  } catch {
    // Ignore failures for restricted contexts
  }
}

export async function ensureDeclarativeActionRules(): Promise<void> {
  const declarative = (
    browser as unknown as { declarativeContent?: typeof chrome.declarativeContent }
  ).declarativeContent;

  if (!declarative?.onPageChanged || !declarative.PageStateMatcher || !declarative.ShowAction) {
    return;
  }

  const rules = [
    {
      conditions: CHATGPT_RULES.map(
        (rule) => new declarative.PageStateMatcher({ pageUrl: rule })
      ),
      actions: [new declarative.ShowAction()],
    },
  ];

  await new Promise<void>((resolve) => {
    declarative.onPageChanged.removeRules(undefined, () => resolve());
  });

  declarative.onPageChanged.addRules(rules);
}

export async function syncActionStateForAllTabs(): Promise<void> {
  if (!browser.action) {
    return;
  }

  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (!tab?.id) continue;
      updateActionForTab(tab.id, tab.url);
    }
  } catch {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      for (const tab of tabs) {
        if (!tab?.id) continue;
        updateActionForTab(tab.id, tab.url);
      }
    } catch {
      // Ignore tab query failures
    }
  }
}
