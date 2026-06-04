import { useLayoutEffect, useRef } from 'react'

/** Sync enter button sizes on the competitions page (desktop). Cards keep natural height. */
export function useMatchedCompetitionCardHeight(syncKey = 0) {
  const paidCardRef = useRef(null)
  const shirtCardRef = useRef(null)

  useLayoutEffect(() => {
    const paidSlot = paidCardRef.current
    const shirtSlot = shirtCardRef.current
    if (!paidSlot || !shirtSlot) return

    const editorPreview = typeof syncKey === 'string' && syncKey.split('|').pop() === 'edit'

    const mq = window.matchMedia('(min-width: 768px)')

    function clearHeights() {
      for (const slot of [paidSlot, shirtSlot]) {
        slot.style.removeProperty('height')
        slot.style.removeProperty('minHeight')
        slot.style.removeProperty('maxHeight')
        const card = slot.querySelector('[data-competition-card]')
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
        clearHeights()
        clearButtonStyles()
        return
      }

      clearHeights()
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
