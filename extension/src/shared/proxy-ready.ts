const PROXY_READY_ATTR = 'data-ls-proxy-ready';
const PROXY_READY_VALUE = '1';

export function markProxyReady(root: Element = document.documentElement): void {
  root.setAttribute(PROXY_READY_ATTR, PROXY_READY_VALUE);
}

export function clearProxyReady(root: Element = document.documentElement): void {
  root.removeAttribute(PROXY_READY_ATTR);
}

export function hasProxyReadyMarker(root: Element = document.documentElement): boolean {
  return root.getAttribute(PROXY_READY_ATTR) === PROXY_READY_VALUE;
}

export function isProxyReadySatisfied(
  postMessageObserved: boolean,
  root: Element = document.documentElement
): boolean {
  return postMessageObserved || hasProxyReadyMarker(root);
}
