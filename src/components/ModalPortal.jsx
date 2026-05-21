import { createPortal } from 'react-dom'

/** Render modals on document.body — avoids page-bg isolation and overflow traps (Safari, Brave). */
export function ModalPortal({ children }) {
  if (typeof document === 'undefined') return children
  return createPortal(children, document.body)
}
