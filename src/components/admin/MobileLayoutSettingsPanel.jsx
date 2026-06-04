import { EDITOR_VIEWPORT_MOBILE } from '../../../shared/layoutOffsets.mjs'

/**
 * Sidebar panel shown while editing mobile-specific drag offsets in the page editor.
 */
export function MobileLayoutSettingsPanel({ editorViewport, onResetPageMobile, onResetLegacyMobile, onResetShirtMobile }) {
  if (editorViewport !== EDITOR_VIEWPORT_MOBILE) return null

  return (
    <section className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-200/90">Mobile layout</h2>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
        You are editing positions for screens under 768px. Drag blocks in the mobile preview — changes here do not
        affect desktop layout.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onResetPageMobile ? (
          <button
            type="button"
            onClick={onResetPageMobile}
            className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100/90 hover:bg-amber-950/40"
          >
            Reset page mobile positions
          </button>
        ) : null}
        {onResetLegacyMobile ? (
          <button
            type="button"
            onClick={onResetLegacyMobile}
            className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100/90 hover:bg-amber-950/40"
          >
            Reset Signed Legacy Bundle mobile panels
          </button>
        ) : null}
        {onResetShirtMobile ? (
          <button
            type="button"
            onClick={onResetShirtMobile}
            className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100/90 hover:bg-amber-950/40"
          >
            Reset shirt card mobile panels
          </button>
        ) : null}
      </div>
    </section>
  )
}
