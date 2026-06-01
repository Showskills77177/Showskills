import { useLayoutEffect, useRef } from 'react'

/** Locks the shirt giveaway card to the same pixel height as the paid competition card. */
export function useMatchedCompetitionCardHeight(syncKey = 0) {
  const paidCardRef = useRef(null)
  const shirtCardRef = useRef(null)

  useLayoutEffect(() => {
    const paidEl = paidCardRef.current
    const shirtEl = shirtCardRef.current
    if (!paidEl || !shirtEl) return

    function sync() {
      const paidCard = paidEl.querySelector('[data-competition-card]') || paidEl
      const h = Math.round(paidCard.getBoundingClientRect().height)
      if (h < 1) return
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
    const paidCard = paidEl.querySelector('[data-competition-card]')
    if (paidCard) ro.observe(paidCard)
    ro.observe(shirtEl)

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
      shirtEl.style.removeProperty('height')
      shirtEl.style.removeProperty('minHeight')
      shirtEl.style.removeProperty('maxHeight')
      shirtEl.style.removeProperty('--ss-matched-comp-card-h')
    }
  }, [syncKey])

  return { paidCardRef, shirtCardRef }
}
