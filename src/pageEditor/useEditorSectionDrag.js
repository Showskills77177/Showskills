import { useCallback, useEffect, useRef, useState } from 'react'
import {
  reorderHomeVisualSections,
  reorderHomepageBlocks,
  isHomeVisualSectionId,
} from './homepageVisualSections.mjs'

function readDropTarget(clientX, clientY, dragId) {
  const elements = document.elementsFromPoint(clientX, clientY)
  for (const el of elements) {
    const section = el.closest?.('[data-editor-section]')
    if (!section?.dataset?.editorSection) continue
    const targetId = section.dataset.editorSection
    if (targetId === dragId) continue
    const rect = section.getBoundingClientRect()
    const position = clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    return { targetId, position }
  }
  return null
}

function applyHomepageReorder(blockOrder, dragId, targetId, position) {
  if (isHomeVisualSectionId(dragId) && isHomeVisualSectionId(targetId)) {
    return reorderHomeVisualSections(blockOrder, dragId, targetId, position)
  }
  if (!isHomeVisualSectionId(dragId) && !isHomeVisualSectionId(targetId)) {
    return reorderHomepageBlocks(blockOrder, dragId, targetId, position)
  }
  if (!isHomeVisualSectionId(dragId) && isHomeVisualSectionId(targetId)) {
    const anchor =
      targetId === 'hero'
        ? blockOrder.find((id) =>
            ['promo_strip', 'hero_intro', 'hero_prizes', 'hero_details', 'ticket_bundles'].includes(id),
          ) || 'hero_intro'
        : targetId
    return reorderHomepageBlocks(blockOrder, dragId, anchor, position)
  }
  if (isHomeVisualSectionId(dragId) && !isHomeVisualSectionId(targetId)) {
    const fromBlock = dragId === 'hero' ? 'hero_intro' : dragId
    return reorderHomepageBlocks(blockOrder, fromBlock, targetId, position)
  }
  return blockOrder
}

/**
 * Pointer-based section reorder for the visual page editor (replaces HTML5 drag).
 */
export function useEditorSectionDrag({ blockOrder, onPatchBlockOrder }) {
  const [dragId, setDragId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [dropPosition, setDropPosition] = useState('before')
  const dragIdRef = useRef(null)

  const clearDrag = useCallback(() => {
    dragIdRef.current = null
    setDragId(null)
    setDropTargetId(null)
    setDropPosition('before')
    document.body.classList.remove('ss-editor-dragging')
  }, [])

  const commitReorder = useCallback(
    (fromId, targetId, position) => {
      if (!fromId || !targetId || !blockOrder?.length) return
      const nextOrder = applyHomepageReorder(blockOrder, fromId, targetId, position)
      if (nextOrder !== blockOrder) onPatchBlockOrder(nextOrder)
    },
    [blockOrder, onPatchBlockOrder],
  )

  const startDrag = useCallback((id, e) => {
    e.preventDefault()
    e.stopPropagation()
    dragIdRef.current = id
    setDragId(id)
    setDropTargetId(null)
    setDropPosition('before')
    document.body.classList.add('ss-editor-dragging')
  }, [])

  const moveDrag = useCallback((clientX, clientY) => {
    const activeId = dragIdRef.current
    if (!activeId) return
    const target = readDropTarget(clientX, clientY, activeId)
    if (!target) {
      setDropTargetId(null)
      return
    }
    setDropTargetId(target.targetId)
    setDropPosition(target.position)
  }, [])

  const endDrag = useCallback(
    (clientX, clientY) => {
      const fromId = dragIdRef.current
      if (!fromId) {
        clearDrag()
        return
      }
      const target = readDropTarget(clientX, clientY, fromId)
      if (target) commitReorder(fromId, target.targetId, target.position)
      clearDrag()
    },
    [clearDrag, commitReorder],
  )

  useEffect(() => {
    if (!dragId) return undefined

    function onPointerMove(e) {
      moveDrag(e.clientX, e.clientY)
    }

    function onPointerUp(e) {
      endDrag(e.clientX, e.clientY)
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') clearDrag()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dragId, moveDrag, endDrag, clearDrag])

  const nudgeSection = useCallback(
    (id, direction) => {
      if (!blockOrder?.length) return
      if (isHomeVisualSectionId(id)) {
        const sections = ['hero', 'competitions_hub', 'winners_panel'].filter((sid) => {
          if (sid === 'hero') return blockOrder.some((bid) => ['promo_strip', 'hero_intro', 'hero_prizes', 'hero_details', 'ticket_bundles'].includes(bid))
          return blockOrder.includes(sid)
        })
        const idx = sections.indexOf(id)
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1
        if (idx < 0 || targetIdx < 0 || targetIdx >= sections.length) return
        const nextOrder = reorderHomeVisualSections(blockOrder, id, sections[targetIdx], direction === 'up' ? 'before' : 'after')
        if (nextOrder !== blockOrder) onPatchBlockOrder(nextOrder)
        return
      }
      const idx = blockOrder.indexOf(id)
      if (idx < 0) return
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= blockOrder.length) return
      const position = direction === 'up' ? 'before' : 'after'
      const nextOrder = reorderHomepageBlocks(blockOrder, id, blockOrder[targetIdx], position)
      if (nextOrder !== blockOrder) onPatchBlockOrder(nextOrder)
    },
    [blockOrder, onPatchBlockOrder],
  )

  return {
    dragId,
    dropTargetId,
    dropPosition,
    startDrag,
    nudgeSection,
  }
}
