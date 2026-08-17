/**
 * Small DOM and URL helpers shared by the UI screens.
 *
 * These helpers deliberately stay framework-free so the screens can keep
 * owning their markup and event flow while sharing the browser edge cases.
 */

export function assetUrl(path) {
  const base = import.meta.env?.BASE_URL ?? '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${String(path).replace(/^\/+/, '')}`
}

export const UI_DIRECTIONS = new Map([
  ['ArrowLeft', -1], ['ArrowUp', -1], ['KeyA', -1], ['KeyW', -1],
  ['ArrowRight', 1], ['ArrowDown', 1], ['KeyD', 1], ['KeyS', 1],
])

export function focusElement(element) {
  element?.focus?.({ preventScroll: true })
}

export function isButtonTarget(target) {
  const element = target?.closest?.('button,[role="button"]') ?? target
  const tag = String(element?.tagName ?? element?.nodeName ?? '').toLowerCase()
  return tag === 'button' || element?.getAttribute?.('role') === 'button'
}

export function blurOwnedFocus(node) {
  if (typeof document === 'undefined') return
  const active = document.activeElement
  if (active && (active === node || node.contains?.(active))) active.blur?.()
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
