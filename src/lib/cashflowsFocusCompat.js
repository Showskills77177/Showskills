/** Cashflows embedded iframes — same Safari / overlay focus issues as Stripe Payment Element. */

export const CASHFLOWS_MOUNT_SELECTOR = '.ss-cashflows-pay'

/** Copied from host inputs into Cashflows iframes at init — keep text light on dark fields. */
export const CASHFLOWS_FIELD_THEME = {
  color: '#ffffff',
  backgroundColor: 'rgb(7, 21, 18)',
  fontSize: '16px',
  lineHeight: '1.25',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  caretColor: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  boxSizing: 'border-box',
}

export function applyCashflowsHostFieldTheme(input) {
  if (!(input instanceof HTMLInputElement)) return
  Object.assign(input.style, CASHFLOWS_FIELD_THEME)
  input.style.setProperty('-webkit-text-fill-color', '#ffffff')
}

export function applyCashflowsIframeTheme(iframe) {
  if (!(iframe instanceof HTMLIFrameElement)) return
  Object.assign(iframe.style, CASHFLOWS_FIELD_THEME)
  iframe.style.setProperty('-webkit-text-fill-color', '#ffffff')
  iframe.style.colorScheme = 'dark'
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
  return isAppleMobile || isIpadOs
}

/** Apple Pay embedded button only works in Safari with ApplePaySession (not a redirect). */
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

/**
 * After Cashflows replaces inputs with iframes, force them interactive (Steps 1–3 Stripe parity).
 */
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

  scope.querySelectorAll('.ss-cf-field-wrap, .ss-cf-field-host, .ss-checkout-card-panel').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.pointerEvents = 'auto'
      el.style.transform = 'none'
      el.style.webkitTransform = 'none'
    }
  })

  scope.querySelectorAll('iframe').forEach((iframe) => {
    iframe.style.pointerEvents = 'auto'
    iframe.style.position = 'relative'
    iframe.style.zIndex = '1'
    iframe.style.transform = 'none'
    iframe.style.webkitTransform = 'none'
    applyCashflowsIframeTheme(iframe)
  })
}

/**
 * @param {HTMLElement | null} root — payment sheet panel
 * @returns {() => void}
 */
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

export function scheduleCashflowsPointerFix(root, { durationMs = 4000, intervalMs = 400 } = {}) {
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
