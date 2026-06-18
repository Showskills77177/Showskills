import { useLayoutEffect, useRef } from 'react'

/** On desktop, sizes the Ronaldo shirt card to the Signed Legacy Bundle card height (legacy stays natural). */
export function useMatchedCompetitionCardHeight(syncKey = 0) {
  const paidCardRef = useRef(null)
  const shirtCardRef = useRef(null)

  useLayoutEffect(() => {
    const paidSlot = paidCardRef.current
    const shirtSlot = shirtCardRef.current
    if (!paidSlot || !shirtSlot) return

    const editorPreview = typeof syncKey === 'string' && syncKey.split('|').pop() === 'edit'

    const mq = window.matchMedia('(min-width: 768px)')
    let lastLegacyHeight = 0

    function cardIn(slot) {
      return slot.querySelector('[data-competition-card]')
    }

    function measureNatural(slot) {
      const card = cardIn(slot)
      const el = card || slot
      const rectH = Math.round(el.getBoundingClientRect().height)
      const offsetH = el.offsetHeight ? Math.round(el.offsetHeight) : 0
      return Math.max(rectH, offsetH, 1)
    }

    function clearShirtSizing() {
      shirtSlot.style.removeProperty('height')
      shirtSlot.style.removeProperty('minHeight')
      shirtSlot.style.removeProperty('maxHeight')
      shirtSlot.removeAttribute('data-matched-height')
      shirtSlot.style.removeProperty('--ss-matched-comp-card-h')
      const shirtCard = cardIn(shirtSlot)
      if (shirtCard) {
        shirtCard.style.removeProperty('height')
        shirtCard.style.removeProperty('minHeight')
        shirtCard.style.removeProperty('maxHeight')
        shirtCard.style.removeProperty('overflow')
      }
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

    function applyShirtToLegacyHeight(legacyH) {
      shirtSlot.style.height = `${legacyH}px`
      shirtSlot.style.minHeight = `${legacyH}px`
      shirtSlot.style.maxHeight = `${legacyH}px`
      shirtSlot.style.boxSizing = 'border-box'
      shirtSlot.dataset.matchedHeight = 'true'
      shirtSlot.style.setProperty('--ss-matched-comp-card-h', `${legacyH}px`)

      const shirtCard = cardIn(shirtSlot)
      if (shirtCard) {
        shirtCard.style.height = '100%'
        shirtCard.style.minHeight = '0'
        shirtCard.style.maxHeight = '100%'
        shirtCard.style.overflow = 'hidden'
        shirtCard.style.boxSizing = 'border-box'
      }
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
      if (editorPreview || !mq.matches) {
        clearShirtSizing()
        clearButtonStyles()
        return
      }

      clearShirtSizing()

      const legacyH = measureNatural(paidSlot)
      if (legacyH < 2) return

      if (legacyH === lastLegacyHeight && shirtSlot.dataset.matchedHeight === 'true') {
        syncEnterButtons()
        return
      }
      lastLegacyHeight = legacyH

      applyShirtToLegacyHeight(legacyH)
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
      clearShirtSizing()
      clearButtonStyles()
    }
  }, [syncKey])

  return { paidCardRef, shirtCardRef }
}
