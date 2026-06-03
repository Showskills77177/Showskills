import { useLayoutEffect, useRef } from 'react'

/**
 * Locks legacy details card height to the ticket bundles panel and sets
 * --ss-details-fill-scale so content fits (grows or shrinks) in editor and preview.
 */
export function useMatchedPanelHeight(syncKey = 0, { enabled = true } = {}) {
  const referenceRef = useRef(null)
  const targetRef = useRef(null)

  useLayoutEffect(() => {
    if (!enabled) return undefined
    const reference = referenceRef.current
    const target = targetRef.current
    if (!reference || !target) return

    const mq = window.matchMedia('(min-width: 768px)')

    function sync() {
      const card = target.querySelector('.ss-legacy-details-card')
      if (!card) return

      if (!mq.matches) {
        target.style.removeProperty('--ss-matched-panel-h')
        target.style.removeProperty('--ss-details-fill-scale')
        card.style.removeProperty('height')
        card.style.removeProperty('minHeight')
        card.style.removeProperty('maxHeight')
        return
      }

      const refEl = reference.querySelector('.ss-ticket-bundles-panel') || reference
      const panelH = Math.round(refEl.getBoundingClientRect().height)
      if (panelH < 1) return

      target.style.setProperty('--ss-matched-panel-h', `${panelH}px`)

      const prevH = card.style.height
      const prevMin = card.style.minHeight
      const prevMax = card.style.maxHeight
      card.style.height = 'auto'
      card.style.minHeight = '0'
      card.style.maxHeight = 'none'
      const naturalH = Math.round(card.getBoundingClientRect().height)
      card.style.height = prevH
      card.style.minHeight = prevMin
      card.style.maxHeight = prevMax

      let fill = 1
      if (naturalH > 0) {
        fill = Math.min(1.12, Math.max(0.86, (panelH / naturalH) * 0.985))
      }

      target.style.setProperty('--ss-details-fill-scale', String(Number(fill.toFixed(3))))
      card.style.setProperty('--ss-details-fill-scale', String(Number(fill.toFixed(3))))
      card.style.height = `${panelH}px`
      card.style.minHeight = `${panelH}px`
      card.style.maxHeight = `${panelH}px`
    }

    sync()
    const raf = requestAnimationFrame(sync)
    const t1 = window.setTimeout(sync, 100)
    const t2 = window.setTimeout(sync, 400)

    const ro = new ResizeObserver(sync)
    ro.observe(reference)
    const refPanel = reference.querySelector('.ss-ticket-bundles-panel')
    if (refPanel) ro.observe(refPanel)
    ro.observe(target)
    const cardEl = target.querySelector('.ss-legacy-details-card')
    if (cardEl) ro.observe(cardEl)

    mq.addEventListener('change', sync)
    window.addEventListener('resize', sync)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      ro.disconnect()
      mq.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      target.style.removeProperty('--ss-matched-panel-h')
      target.style.removeProperty('--ss-details-fill-scale')
      const card = target.querySelector('.ss-legacy-details-card')
      if (card) {
        card.style.removeProperty('height')
        card.style.removeProperty('minHeight')
        card.style.removeProperty('maxHeight')
        card.style.removeProperty('--ss-details-fill-scale')
      }
    }
  }, [syncKey, enabled])

  return { referenceRef, targetRef }
}
