import { useEffect, useRef, useState } from 'react'
import { offsetStyle, snapOffset, EDITOR_SNAP_GRID_PX } from '../../../shared/layoutOffsets.mjs'
import {
  alignBetweenSiblings,
  alignWithSiblingsCenterX,
  centerInRoot,
  centerRootFor,
  contentBoundsFor,
} from '../../../shared/editorAlign.mjs'
import { EditableDragToolbar } from './EditableDragToolbar'

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
  /** Position only — no resize; scale is always 1. */
  moveOnly = false,
  scaleMin: scaleMinProp = 0.55,
  scaleMax: scaleMaxProp = 1.85,
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
  const [snapEnabled, setSnapEnabled] = useState(true)
  const removeWindowListeners = useRef(null)

  const offsetX = live?.x ?? x
  const offsetY = live?.y ?? y
  const activeScale = moveOnly ? 1 : scale || 1
  const style = cssScaleOnly
    ? offsetX || offsetY
      ? { transform: `translate(${offsetX}px, ${offsetY}px)`, transformOrigin }
      : undefined
    : offsetStyle(
        { x: offsetX, y: offsetY, scale: activeScale },
        { scale: activeScale, transformOrigin, widthOnly: moveOnly ? true : widthOnly },
      )

  function applyPosition(next, snap = snapEnabled) {
    const snapped = snapOffset(
      { x: next.x, y: next.y, scale: activeScale },
      { grid: EDITOR_SNAP_GRID_PX, snap },
    )
    setLive(null)
    onChange?.({ x: snapped.x, y: snapped.y, scale: snapped.scale })
  }

  function centerAxis(axis) {
    const el = frameRef.current
    if (!el) return
    const content = contentBoundsFor(el)
    if (!content) return

    let next = { x: offsetX, y: offsetY }
    if (axis === 'x' || axis === 'both') {
      const rootX = centerRootFor(el, 'x')
      next = centerInRoot(content, rootX, next.x, next.y, 'x')
    }
    if (axis === 'y' || axis === 'both') {
      const rootY = centerRootFor(el, 'y')
      next = centerInRoot(content, rootY, next.x, next.y, 'y')
    }
    applyPosition(next)
  }

  function betweenSiblings(axis) {
    const el = frameRef.current
    if (!el) return
    const content = contentBoundsFor(el)
    if (!content) return
    const next = alignBetweenSiblings(el, content, offsetX, offsetY, axis)
    applyPosition(next)
  }

  function matchSiblings() {
    const el = frameRef.current
    if (!el) return
    const content = contentBoundsFor(el)
    if (!content) return
    const next = alignWithSiblingsCenterX(el, content, offsetX, offsetY)
    applyPosition(next)
  }

  function resetPosition() {
    onChange?.({ x: 0, y: 0, scale: activeScale })
    setLive(null)
  }

  function shouldIgnoreDragTarget(t) {
    if (!(t instanceof Element)) return true
    if (t.closest('[data-editor-ui]')) return true
    if (t.closest('button,a,input,textarea,select,[contenteditable="true"]')) return true
    return false
  }

  function onPointerDown(e) {
    if (e.button !== 0) return
    const nestedDrag = e.target instanceof Element ? e.target.closest('[data-editor-drag]') : null
    if (nestedDrag && nestedDrag !== frameRef.current) return
    if (shouldIgnoreDragTarget(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu(null)
    const resizeMode = !moveOnly && (e.ctrlKey || e.metaKey)
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
      const fine = ev.shiftKey
      setSnapEnabled(!fine)
      if (resizing.current) {
        const dx = ev.clientX - resizeStart.current.px
        const delta = dx / (widthOnly ? 280 : 420)
        updateScaleAdaptive(resizeStart.current.scale + delta)
        return
      }
      if (!dragging.current) return
      const dx = ev.clientX - start.current.px
      const dy = ev.clientY - start.current.py
      const rawX = Math.round(start.current.x + dx)
      const rawY = Math.round(start.current.y + dy)
      const snapped = snapOffset(
        { x: rawX, y: rawY },
        { grid: EDITOR_SNAP_GRID_PX, snap: !fine },
      )
      setLive({ x: snapped.x, y: snapped.y })
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
    const rawX = Math.round(start.current.x + dx)
    const rawY = Math.round(start.current.y + dy)
    const fine = e.shiftKey
    const snapped = snapOffset(
      { x: rawX, y: rawY },
      { grid: EDITOR_SNAP_GRID_PX, snap: !fine },
    )
    setLive(null)
    setSnapEnabled(true)
    if (wasResizing) {
      onChange?.({ scale: resizeStart.current.lastScale || activeScale })
    } else if (snapped.x !== start.current.x || snapped.y !== start.current.y) {
      onChange?.({ x: snapped.x, y: snapped.y, scale: activeScale })
    }
  }

  const scaleMin = scaleMinProp ?? 0.55
  const scaleMax = scaleMaxProp ?? 1.85
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
      className={`relative ${selected ? 'z-[20]' : ''} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        if (!selected) onSelect?.(id)
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {selected ? (
        <EditableDragToolbar
          onCenter={centerAxis}
          onBetween={betweenSiblings}
          onMatchSiblings={matchSiblings}
          onReset={resetPosition}
        />
      ) : null}

      <div
        className={`relative ${selected ? 'ring-2 ring-teal-400/90 ring-offset-1 ring-offset-[#050807]' : 'ring-1 ring-transparent hover:ring-teal-400/20'}`}
      >
        {children}
      </div>

      {contextMenu ? (
        <div
          className="fixed z-[9999] min-w-[11rem] rounded-lg border border-white/15 bg-stone-950/95 p-1 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
          role="menu"
          aria-label="Element actions"
          data-editor-ui
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MenuItem onClick={() => { centerAxis('x'); setContextMenu(null) }}>Center in panel (width)</MenuItem>
          <MenuItem onClick={() => { centerAxis('y'); setContextMenu(null) }}>Center in panel (height)</MenuItem>
          <MenuItem onClick={() => { centerAxis('both'); setContextMenu(null) }}>Center in panel (both)</MenuItem>
          <MenuItem onClick={() => { betweenSiblings('x'); setContextMenu(null) }}>Between neighbours ↔</MenuItem>
          <MenuItem onClick={() => { betweenSiblings('y'); setContextMenu(null) }}>Between neighbours ↕</MenuItem>
          <MenuItem onClick={() => { betweenSiblings('both'); setContextMenu(null) }}>Between neighbours ⊡</MenuItem>
          <MenuItem onClick={() => { matchSiblings(); setContextMenu(null) }}>Match sibling centers ≡</MenuItem>
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({ children, onClick }) {
  return (
    <button
      type="button"
      data-editor-ui
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
      }}
      className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-stone-200 hover:bg-white/5"
      role="menuitem"
    >
      {children}
    </button>
  )
}

/** @deprecated use EditableDragFrame */
export const EditablePrizeFrame = EditableDragFrame
