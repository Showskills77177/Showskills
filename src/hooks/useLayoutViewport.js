import { useEffect, useState } from 'react'
import {
  EDITOR_VIEWPORT_DESKTOP,
  EDITOR_VIEWPORT_MOBILE,
  PUBLIC_MOBILE_LAYOUT_MAX_PX,
} from '../../shared/layoutOffsets.mjs'

/** Desktop vs mobile layout bucket — editor viewport in admin, matchMedia on the live site. */
export function useLayoutViewport({ editorMode = false, editorViewport = EDITOR_VIEWPORT_DESKTOP } = {}) {
  const [publicViewport, setPublicViewport] = useState(EDITOR_VIEWPORT_DESKTOP)

  useEffect(() => {
    if (editorMode) return undefined
    const mq = window.matchMedia(`(max-width: ${PUBLIC_MOBILE_LAYOUT_MAX_PX}px)`)
    function update() {
      setPublicViewport(mq.matches ? EDITOR_VIEWPORT_MOBILE : EDITOR_VIEWPORT_DESKTOP)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [editorMode])

  return editorMode ? editorViewport : publicViewport
}
