import { useEffect, useRef, useState } from 'react'
import { offsetStyle } from '../../../shared/layoutOffsets.mjs'

/** Editor-only draggable frame — saves x/y/scale offset to layout JSON. */
export function EditableDragFrame({
  id,
  label,
  x = 0,
  y = 0,
  scale = 1,
  selected = false,
  onSelect,
  onChange,
  children,
  className = '',
  transformOrigin = 'center center',
  /** When true, scale applies via CSS variable on children (frame is not visually scaled). */
  cssScaleOnly = false,
  /** Ctrl/Cmd+drag adjusts horizontal scale only (default). */
  widthOnly = true,
}) {
  const frameRef = useRef(null)
  const dragging = useRef(false)
  const resizing = useRef(false)
  const start = useRef({ px: 0, py: 0, x: 0, y: 0 })
  const resizeStart = useRef({
    px: 0,
    scale: 1,
    baseRect: null,
    parentRect: null,
    siblingRects: [],
    lastScale: 1,
  })
  const [live, setLive] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const removeWindowListeners = useRef(null)

  const offsetX = live?.x ?? x
  const offsetY = live?.y ?? y
  const activeScale = scale || 1
  const style = cssScaleOnly
    ? offsetX || offsetY
      ? { transform: `translate(${offsetX}px, ${offsetY}px)`, transformOrigin }
      : undefined
    : offsetStyle({ x: offsetX, y: offsetY, scale: activeScale }, { scale: activeScale, transformOrigin, widthOnly })

  function centerAxis(axis) {
    const el = frameRef.current
    if (!el) return

    const next = {
      x: offsetX,
      y: offsetY,
      scale: activeScale,
    }

    if (axis === 'x' || axis === 'both') {
      const rootX = el.closest('[data-editor-center-root]') || el.parentElement
      if (rootX) {
        const r = rootX.getBoundingClientRect()
        const e = el.getBoundingClientRect()
        next.x = Math.round(offsetX + (r.left + r.width / 2 - (e.left + e.width / 2)))
      }
    }

    if (axis === 'y' || axis === 'both') {
      const rootY =
        el.closest('[data-editor-center-y-root]') ||
        el.closest('[data-editor-center-root]') ||
        el.parentElement
      if (rootY) {
        const r = rootY.getBoundingClientRect()
        const e = el.getBoundingClientRect()
        next.y = Math.round(offsetY + (r.top + r.height / 2 - (e.top + e.height / 2)))
      }
    }

    onChange?.(next)
  }

  function shouldIgnoreDragTarget(t) {
    if (!(t instanceof Element)) return true
    if (t.closest('button,a,input,textarea,select,[contenteditable="true"],[data-editor-ui]')) return true
    return false
  }

  function onPointerDown(e) {
    if (e.button !== 0) return
    if (shouldIgnoreDragTarget(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu(null)
    const resizeMode = e.ctrlKey || e.metaKey
    dragging.current = !resizeMode
    resizing.current = resizeMode
    start.current = { px: e.clientX, py: e.clientY, x: offsetX, y: offsetY }
    const currentEl = frameRef.current
    const parentEl = currentEl?.parentElement
    const siblingRects =
      currentEl && parentEl
        ? Array.from(parentEl.querySelectorAll('[data-editor-drag]'))
            .filter((n) => n !== currentEl)
            .map((n) => n.getBoundingClientRect())
        : []
    resizeStart.current = {
      px: e.clientX,
      scale: activeScale,
      baseRect: currentEl?.getBoundingClientRect() || null,
      parentRect: parentEl?.getBoundingClientRect() || null,
      siblingRects,
      lastScale: activeScale,
    }
    onSelect?.(id)

    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return
      ev.preventDefault?.()
      if (resizing.current) {
        const dx = ev.clientX - resizeStart.current.px
        const delta = dx / (widthOnly ? 280 : 420)
        updateScaleAdaptive(resizeStart.current.scale + delta)
        return
      }
      if (!dragging.current) return
      const dx = ev.clientX - start.current.px
      const dy = ev.clientY - start.current.py
      setLive({ x: Math.round(start.current.x + dx), y: Math.round(start.current.y + dy) })
    }

    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return
      finishDrag(ev)
    }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up, { passive: false })
    window.addEventListener('pointercancel', up, { passive: false })
    removeWindowListeners.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }

  function finishDrag(e) {
    if (!dragging.current && !resizing.current) return
    const wasResizing = resizing.current
    dragging.current = false
    resizing.current = false
    removeWindowListeners.current?.()
    removeWindowListeners.current = null
    const dx = e.clientX - start.current.px
    const dy = e.clientY - start.current.py
    const nextX = Math.round(start.current.x + dx)
    const nextY = Math.round(start.current.y + dy)
    setLive(null)
    if (wasResizing) {
      onChange?.({ scale: resizeStart.current.lastScale || activeScale })
    } else if (nextX !== start.current.x || nextY !== start.current.y) {
      onChange?.({ x: nextX, y: nextY, scale: activeScale })
    }
  }

  const scaleMin = 0.55
  const scaleMax = 1.85
  function updateScale(nextScale) {
    const clamped = Math.min(scaleMax, Math.max(scaleMin, nextScale))
    const rounded = Math.round(clamped * 100) / 100
    resizeStart.current.lastScale = rounded
    onChange?.({ scale: rounded })
  }

  function updateScaleAdaptive(nextScale) {
    const baseRect = resizeStart.current.baseRect
    const parentRect = resizeStart.current.parentRect
    if (!baseRect || !parentRect) {
      updateScale(nextScale)
      return
    }

    const baseScale = resizeStart.current.scale || 1
    const baseWidth = Math.max(baseRect.width / baseScale, 1)
    const clamp = (v) => Math.min(scaleMax, Math.max(scaleMin, v))
    const target = clamp(nextScale)
    const candidates = [clamp(((parentRect.width - 10) / baseWidth) * baseScale)]

    for (const r of resizeStart.current.siblingRects || []) {
      if (r.width > 0) candidates.push(clamp((r.width / baseWidth) * baseScale))
    }

    let snapped = target
    let bestDist = Infinity
    for (const c of candidates) {
      const d = Math.abs(c - target)
      if (d < bestDist) {
        bestDist = d
        snapped = c
      }
    }
    updateScale(bestDist <= 0.045 ? snapped : target)
  }

  useEffect(() => {
    if (!contextMenu) return
    function close() {
      setContextMenu(null)
    }
    document.addEventListener('mousedown', close, { once: true })
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') close()
      },
      { once: true },
    )
    return () => {}
  }, [contextMenu])

  useEffect(() => {
    return () => {
      removeWindowListeners.current?.()
    }
  }, [])

  return (
    <div
      ref={frameRef}
      data-editor-drag={id}
      data-editor-label={label}
      className={`relative ${selected ? 'z-[4]' : ''} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        if (!selected) onSelect?.(id)
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      <div
        className={`relative ${selected ? 'ring-2 ring-teal-400/90 ring-offset-1 ring-offset-[#050807]' : 'ring-1 ring-transparent hover:ring-teal-400/20'}`}
      >
        {children}

        {selected ? (
          <div
            className="absolute right-0.5 top-0.5 z-[8] flex items-center gap-px rounded border border-white/15 bg-stone-950/90 p-px shadow-md"
            data-editor-ui
          >
            <button
              type="button"
              data-editor-ui
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                centerAxis('x')
              }}
              className="min-w-[1.35rem] rounded px-0.5 py-px text-[8px] font-bold leading-none text-stone-300 hover:bg-white/10 hover:text-teal-200"
              title="Center horizontally"
            >
              X
            </button>
            <button
              type="button"
              data-editor-ui
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                centerAxis('y')
              }}
              className="min-w-[1.35rem] rounded px-0.5 py-px text-[8px] font-bold leading-none text-stone-300 hover:bg-white/10 hover:text-teal-200"
              title="Center vertically"
            >
              Y
            </button>
            <button
              type="button"
              data-editor-ui
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                centerAxis('both')
              }}
              className="min-w-[1.35rem] rounded px-0.5 py-px text-[8px] font-bold leading-none text-teal-300 hover:bg-white/10 hover:text-teal-100"
              title="Center horizontally and vertically"
            >
              ·
            </button>
            <button
              type="button"
              data-editor-ui
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChange?.({ x: 0, y: 0, scale: activeScale })
              }}
              className="min-w-[1.35rem] rounded px-0.5 py-px text-[8px] font-bold leading-none text-stone-500 hover:bg-white/10 hover:text-stone-200"
              title="Reset position"
            >
              0
            </button>
          </div>
        ) : null}
      </div>

      {contextMenu ? (
        <div
          className="fixed z-[9999] min-w-[9rem] rounded-lg border border-white/15 bg-stone-950/95 p-1 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
          role="menu"
          aria-label="Element actions"
        >
          <button
            type="button"
            data-editor-ui
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              centerAxis('x')
              setContextMenu(null)
            }}
            className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-stone-200 hover:bg-white/5"
            role="menuitem"
          >
            Center width
          </button>
          <button
            type="button"
            data-editor-ui
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              centerAxis('y')
              setContextMenu(null)
            }}
            className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-stone-200 hover:bg-white/5"
            role="menuitem"
          >
            Center height
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** @deprecated use EditableDragFrame */
export const EditablePrizeFrame = EditableDragFrame
