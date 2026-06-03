import { createContext, useContext } from 'react'
import { EDITOR_VIEWPORT_DESKTOP } from '../../shared/layoutOffsets.mjs'

const PageEditorPreviewContext = createContext(null)

/** Supplies draft page layouts and editor viewport to public hooks while editing in admin. */
export function PageEditorPreviewProvider({ pages, editorViewport = EDITOR_VIEWPORT_DESKTOP, children }) {
  return (
    <PageEditorPreviewContext.Provider value={{ pages, editorViewport }}>
      {children}
    </PageEditorPreviewContext.Provider>
  )
}

export function usePageEditorDraftPages() {
  const ctx = useContext(PageEditorPreviewContext)
  if (!ctx) return null
  return ctx.pages ?? ctx
}

export function usePageEditorViewport() {
  const ctx = useContext(PageEditorPreviewContext)
  return ctx?.editorViewport ?? EDITOR_VIEWPORT_DESKTOP
}
