/** Cashflows embedded iframes — focus/pointer fixes + dark field chrome. */

export const CASHFLOWS_MOUNT_SELECTOR = '.ss-cashflows-pay'

/** Only these are copied into Cashflows iframes (see cashflows-clientlib-js initCard). */
export const CASHFLOWS_IFRAME_COPY_STYLE = {
  color: 'rgb(245, 245, 244)',
  backgroundColor: 'transparent',
  fontSize: '16px',
  lineHeight: '1.25',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  caretColor: 'rgb(245, 245, 244)',
  padding: '7px 16px',
  border: 'none',
  borderRadius: '0',
  boxShadow: 'none',
  margin: '0',
}

export function applyCashflowsHostFieldTheme(input) {
  if (!(input instanceof HTMLInputElement)) return
  Object.assign(input.style, CASHFLOWS_IFRAME_COPY_STYLE)
  input.style.setProperty('-webkit-text-fill-color', 'rgb(245, 245, 244)')
  input.style.width = '100%'
  input.style.minHeight = '40px'
}

/** Reset SDK-copied styles; host shell provides the visible box. */
export function normalizeCashflowsFieldIframe(iframe) {
  if (!(iframe instanceof HTMLIFrameElement)) return
  iframe.style.cssText = [
    'display:block',
    'width:100%',
    'min-height:40px',
    'height:40px',
    'margin:0',
    'padding:0',
    'border:none',
    'border-radius:0',
    'background:transparent',
    'box-shadow:none',
    'pointer-events:auto',
    'position:relative',
    'z-index:1',
    'transform:none',
    '-webkit-transform:none',
    'color-scheme:dark',
    /* Cross-origin field pages default to light UI — invert to match dark checkout */
    'filter:invert(1) hue-rotate(180deg)',
  ].join(';')
  iframe.setAttribute('allowtransparency', 'true')
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
  return isAppleMobile || isIpadOs
}

export function isApplePayEmbeddedAvailable() {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(window.ApplePaySession && window.ApplePaySession.canMakePayments())
  } catch {
    return false
  }
}

function isInsideCashflowsMount(target) {
  if (!(target instanceof Element)) return false
  if (target.closest(CASHFLOWS_MOUNT_SELECTOR)) return true
  if (target instanceof HTMLIFrameElement && target.className.includes('cf-')) return true
  return false
}

export function enableCashflowsIframePointerEvents(root) {
  if (typeof document === 'undefined') return
  const scope =
    root instanceof Element ? root : document.querySelector(CASHFLOWS_MOUNT_SELECTOR)
  if (!scope) return

  scope.style.pointerEvents = 'auto'
  scope.style.position = 'static'
  scope.style.zIndex = 'auto'
  scope.style.transform = 'none'
  scope.style.webkitTransform = 'none'
  scope.style.overflow = 'visible'

  scope.querySelectorAll('.ss-cf-field-host, .ss-checkout-card-panel').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.pointerEvents = 'auto'
      el.style.transform = 'none'
      el.style.webkitTransform = 'none'
    }
  })

  scope.querySelectorAll('iframe').forEach((iframe) => {
    normalizeCashflowsFieldIframe(iframe)
  })
}

export function attachCashflowsFocusCompat(root) {
  if (!root || typeof root.addEventListener !== 'function') return () => {}

  const onPointerDownCapture = (event) => {
    if (isInsideCashflowsMount(event.target)) return
    const el = event.target
    if (!(el instanceof HTMLElement)) return
    if (el.closest('.ss-cf-pay-button, [data-ss-cf-ignore-focus]')) return
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
      event.stopPropagation()
    }
  }

  root.addEventListener('pointerdown', onPointerDownCapture, true)
  return () => root.removeEventListener('pointerdown', onPointerDownCapture, true)
}

export function focusCashflowsMountForIos() {
  if (!isIosSafari()) return
  const mount = document.querySelector(CASHFLOWS_MOUNT_SELECTOR)
  if (!mount) return
  requestAnimationFrame(() => {
    mount.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  })
}

export function scheduleCashflowsPointerFix(root, { durationMs = 5000, intervalMs = 350 } = {}) {
  const apply = () => enableCashflowsIframePointerEvents(root)
  apply()
  requestAnimationFrame(apply)
  const id = window.setInterval(apply, intervalMs)
  const stop = window.setTimeout(() => clearInterval(id), durationMs)
  return () => {
    clearInterval(id)
    clearTimeout(stop)
  }
}
