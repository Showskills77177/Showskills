import { useLayoutEffect, useRef } from 'react'

/** Locks paid and shirt giveaway cards to the same height so action buttons align. */
export function useMatchedCompetitionCardHeight(syncKey = 0) {
  const paidCardRef = useRef(null)
  const shirtCardRef = useRef(null)

  useLayoutEffect(() => {
    const paidEl = paidCardRef.current
    const shirtEl = shirtCardRef.current
    if (!paidEl || !shirtEl) return

    let lastTargetHeight = 0

    function measure(el) {
      const card = el.querySelector('[data-competition-card]') || el
      return Math.round(card.getBoundingClientRect().height)
    }

    function clearHeights() {
      paidEl.style.removeProperty('height')
      paidEl.style.removeProperty('minHeight')
      shirtEl.style.removeProperty('height')
      shirtEl.style.removeProperty('minHeight')
      shirtEl.style.removeProperty('maxHeight')
      shirtEl.style.removeProperty('--ss-matched-comp-card-h')
    }

    function sync() {
      clearHeights()

      const paidH = measure(paidEl)
      const shirtH = measure(shirtEl)
      const h = Math.max(paidH, shirtH, 1)
      if (h === lastTargetHeight && paidEl.style.height === `${h}px`) return
      lastTargetHeight = h

      paidEl.style.height = `${h}px`
      paidEl.style.minHeight = `${h}px`
      paidEl.style.boxSizing = 'border-box'

      shirtEl.style.setProperty('--ss-matched-comp-card-h', `${h}px`)
      shirtEl.style.height = `${h}px`
      shirtEl.style.minHeight = `${h}px`
      shirtEl.style.maxHeight = `${h}px`
      shirtEl.style.boxSizing = 'border-box'
    }

    sync()
    const raf = requestAnimationFrame(sync)
    const t1 = window.setTimeout(sync, 120)
    const t2 = window.setTimeout(sync, 450)

    const ro = new ResizeObserver(() => sync())
    ro.observe(paidEl)
    ro.observe(shirtEl)
    const paidCard = paidEl.querySelector('[data-competition-card]')
    if (paidCard && paidCard !== paidEl) ro.observe(paidCard)

    paidEl.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', sync, { once: true })
    })
    shirtEl.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', sync, { once: true })
    })

    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      ro.disconnect()
      window.removeEventListener('resize', sync)
      clearHeights()
    }
  }, [syncKey])

  return { paidCardRef, shirtCardRef }
}
