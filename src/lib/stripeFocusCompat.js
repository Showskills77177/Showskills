/** Mount container id — must match HTML div and elements.create().mount('#…'). */
export const PAYMENT_ELEMENT_CONTAINER_ID = 'payment-element-container'

/** Detect iOS / iPadOS Safari for focus helpers. */
export function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
  return isAppleMobile || isIpadOs
}

const STRIPE_MOUNT_SELECTOR = `#${PAYMENT_ELEMENT_CONTAINER_ID}`

function isInsideStripeMount(target) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(STRIPE_MOUNT_SELECTOR) || target.closest('iframe[name^="__privateStripeFrame"]'))
}

/**
 * Step 3 — after mount, force pointer-events on container + Stripe iframes.
 */
export function enablePaymentElementPointerEvents() {
  if (typeof document === 'undefined') return
  const el = document.getElementById(PAYMENT_ELEMENT_CONTAINER_ID)
  if (!el) return

  el.style.pointerEvents = 'auto'
  el.style.display = 'block'
  el.style.width = '100%'
  el.style.height = 'auto'
  el.style.minHeight = '150px'
  el.style.visibility = 'visible'
  el.style.opacity = '1'
  el.style.position = 'static'
  el.style.zIndex = 'auto'

  el.querySelectorAll('iframe').forEach((iframe) => {
    iframe.style.pointerEvents = 'auto'
    iframe.style.position = 'static'
    iframe.style.zIndex = 'auto'
    iframe.style.transform = 'none'
    iframe.style.webkitTransform = 'none'
  })
}

/**
 * @param {HTMLElement | null} root
 * @returns {() => void}
 */
export function attachStripeFocusCompat(root) {
  if (!root || typeof root.addEventListener !== 'function') return () => {}

  const onPointerDownCapture = (event) => {
    if (isInsideStripeMount(event.target)) return
    const el = event.target
    if (!(el instanceof HTMLElement)) return
    if (el.closest('.ss-stripe-pay-button, [data-ss-stripe-ignore-focus]')) return
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
      event.stopPropagation()
    }
  }

  root.addEventListener('pointerdown', onPointerDownCapture, true)

  return () => {
    root.removeEventListener('pointerdown', onPointerDownCapture, true)
  }
}

export function focusStripeMountForIos() {
  if (!isIosSafari()) return
  const mount = document.getElementById(PAYMENT_ELEMENT_CONTAINER_ID)
  if (!mount) return
  requestAnimationFrame(() => {
    mount.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  })
}
