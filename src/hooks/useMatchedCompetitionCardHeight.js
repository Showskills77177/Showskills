import { useLayoutEffect, useRef } from 'react'

/** Locks paid and shirt giveaway cards (and enter buttons) to the same size on the competitions page. */
export function useMatchedCompetitionCardHeight(syncKey = 0) {
  const paidCardRef = useRef(null)
  const shirtCardRef = useRef(null)

  useLayoutEffect(() => {
    const paidSlot = paidCardRef.current
    const shirtSlot = shirtCardRef.current
    if (!paidSlot || !shirtSlot) return

    const mq = window.matchMedia('(min-width: 1024px)')
    let lastTargetHeight = 0

    function cardIn(slot) {
      return slot.querySelector('[data-competition-card]')
    }

    function measure(slot) {
      const card = cardIn(slot)
      const el = card || slot
      const rectH = Math.round(el.getBoundingClientRect().height)
      const offsetH = el.offsetHeight ? Math.round(el.offsetHeight) : 0
      return Math.max(rectH, offsetH, 1)
    }

    function clearHeights() {
      for (const slot of [paidSlot, shirtSlot]) {
        slot.style.removeProperty('height')
        slot.style.removeProperty('minHeight')
        slot.style.removeProperty('maxHeight')
        const card = cardIn(slot)
        if (card) {
          card.style.removeProperty('height')
          card.style.removeProperty('minHeight')
          card.style.removeProperty('maxHeight')
          card.style.removeProperty('flex')
        }
      }
      shirtSlot.style.removeProperty('--ss-matched-comp-card-h')
    }

    function clearButtonStyles() {
      for (const slot of [paidSlot, shirtSlot]) {
        slot.querySelectorAll('.ss-competition-enter-btn').forEach((btn) => {
          btn.style.removeProperty('width')
          btn.style.removeProperty('maxWidth')
          btn.style.removeProperty('height')
          btn.style.removeProperty('minHeight')
          btn.style.removeProperty('marginInline')
        })
      }
    }

    function applyPanelHeights(h) {
      for (const slot of [paidSlot, shirtSlot]) {
        slot.style.height = `${h}px`
        slot.style.minHeight = `${h}px`
        slot.style.boxSizing = 'border-box'
        const card = cardIn(slot)
        if (card) {
          card.style.height = '100%'
          card.style.minHeight = '0'
          card.style.width = '100%'
          card.style.boxSizing = 'border-box'
        }
      }
      shirtSlot.style.setProperty('--ss-matched-comp-card-h', `${h}px`)
    }

    function syncEnterButtons() {
      const paidBtn = paidSlot.querySelector('.ss-competition-enter-btn')
      const shirtBtn = shirtSlot.querySelector('.ss-competition-enter-btn')
      if (!paidBtn || !shirtBtn) return

      clearButtonStyles()

      const targetW = Math.round(paidBtn.getBoundingClientRect().width)
      const targetH = Math.max(
        Math.round(paidBtn.getBoundingClientRect().height),
        Math.round(shirtBtn.getBoundingClientRect().height),
        52,
      )
      if (targetW < 2) return

      for (const btn of [paidBtn, shirtBtn]) {
        btn.style.width = `${targetW}px`
        btn.style.maxWidth = `${targetW}px`
        btn.style.height = `${targetH}px`
        btn.style.minHeight = `${targetH}px`
        btn.style.marginInline = 'auto'
        btn.style.boxSizing = 'border-box'
      }
    }

    function sync() {
      if (!mq.matches) {
        clearHeights()
        clearButtonStyles()
        return
      }

      clearHeights()

      const paidH = measure(paidSlot)
      const shirtH = measure(shirtSlot)
      const h = Math.max(paidH, shirtH, 1)

      if (h === lastTargetHeight && paidSlot.style.height === `${h}px`) {
        syncEnterButtons()
        return
      }
      lastTargetHeight = h

      applyPanelHeights(h)
      syncEnterButtons()
    }

    sync()
    const raf = requestAnimationFrame(sync)
    const t1 = window.setTimeout(sync, 120)
    const t2 = window.setTimeout(sync, 450)
    const t3 = window.setTimeout(sync, 1000)

    const ro = new ResizeObserver(() => sync())
    ro.observe(paidSlot)
    ro.observe(shirtSlot)
    const paidCard = cardIn(paidSlot)
    const shirtCard = cardIn(shirtSlot)
    if (paidCard) ro.observe(paidCard)
    if (shirtCard) ro.observe(shirtCard)

    for (const slot of [paidSlot, shirtSlot]) {
      slot.querySelectorAll('img').forEach((img) => {
        if (!img.complete) img.addEventListener('load', sync, { once: true })
      })
    }

    mq.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      ro.disconnect()
      mq.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      clearHeights()
      clearButtonStyles()
    }
  }, [syncKey])

  return { paidCardRef, shirtCardRef }
}
