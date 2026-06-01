import { createContext, useContext } from 'react'

const PageEditorPreviewContext = createContext(null)

/** Supplies draft page layouts to public hooks while editing in admin. */
export function PageEditorPreviewProvider({ pages, children }) {
  return <PageEditorPreviewContext.Provider value={pages}>{children}</PageEditorPreviewContext.Provider>
}

export function usePageEditorDraftPages() {
  return useContext(PageEditorPreviewContext)
}
