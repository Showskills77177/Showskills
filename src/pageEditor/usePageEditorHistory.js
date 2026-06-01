import { useCallback, useEffect, useState } from 'react'

const MAX_HISTORY = 50

/**
 * Undo/redo stack for page editor draft state (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z).
 */
export function usePageEditorHistory(initialPages) {
  const [stack, setStack] = useState({
    past: [],
    present: initialPages,
    future: [],
  })

  const replacePages = useCallback((nextPages) => {
    setStack({ past: [], present: nextPages, future: [] })
  }, [])

  const setPages = useCallback((updater) => {
    setStack(({ past, present, future }) => {
      const next = typeof updater === 'function' ? updater(present) : updater
      if (next === present) return { past, present, future }
      return {
        past: [...past.slice(-(MAX_HISTORY - 1)), present],
        present: next,
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    setStack(({ past, present, future }) => {
      if (!past.length) return { past, present, future }
      const previous = past[past.length - 1]
      return {
        past: past.slice(0, -1),
        present: previous,
        future: [present, ...future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setStack(({ past, present, future }) => {
      if (!future.length) return { past, present, future }
      const next = future[0]
      return {
        past: [...past, present],
        present: next,
        future: future.slice(1),
      }
    })
  }, [])

  return {
    pages: stack.present,
    setPages,
    replacePages,
    undo,
    redo,
    canUndo: stack.past.length > 0,
    canRedo: stack.future.length > 0,
  }
}

/** Keyboard shortcuts for undo/redo (skipped when typing in inputs). */
export function useEditorHistoryShortcuts({ undo, redo, enabled = true }) {
  useEffect(() => {
    if (!enabled) return undefined

    function onKeyDown(e) {
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, enabled])
}
