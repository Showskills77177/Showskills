import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react'

/**
 * Click-to-select + pointer-drag overlay for the visual page editor canvas.
 */
export function EditableSectionOverlay({
  id,
  label,
  selected = false,
  hidden = false,
  draggable = false,
  dragging = false,
  dropTarget = false,
  dropPosition = 'before',
  variant = 'section',
  onSelect,
  onStartDrag,
  onNudge,
  children,
}) {
  if (hidden) return children

  const isBlock = variant === 'block'

  return (
    <div
      className={`relative transition-opacity ${dragging ? 'opacity-40' : ''} ${
        dropTarget ? 'z-[6]' : ''
      }`}
      data-editor-section={id}
    >
      {dropTarget && dropPosition === 'before' ? (
        <div
          className="pointer-events-none absolute -top-1.5 left-2 right-2 z-[12] h-1 rounded-full bg-teal-400 shadow-[0_0_14px_rgba(45,212,191,0.95)]"
          aria-hidden
        />
      ) : null}
      {dropTarget && dropPosition === 'after' ? (
        <div
          className="pointer-events-none absolute -bottom-1.5 left-2 right-2 z-[12] h-1 rounded-full bg-teal-400 shadow-[0_0_14px_rgba(45,212,191,0.95)]"
          aria-hidden
        />
      ) : null}

      {children}

      <div
        className={`pointer-events-none absolute inset-0 z-[5] transition ${
          selected
            ? 'border-2 border-teal-400 bg-transparent shadow-[inset_0_0_0_1px_rgba(45,212,191,0.35)]'
            : isBlock
              ? 'border border-dashed border-transparent hover:border-teal-400/35'
              : 'border-2 border-transparent hover:border-teal-400/40 hover:bg-teal-400/5'
        } ${dropTarget ? 'ring-2 ring-teal-400/50' : ''}`}
        aria-hidden
      />

      <div
        className={`absolute z-[10] flex max-w-[calc(100%-0.5rem)] items-center gap-1 ${
          isBlock ? 'bottom-2 left-2' : 'left-2 top-2'
        }`}
      >
        {draggable ? (
          <div
            role="button"
            tabIndex={0}
            aria-label={`Drag ${label} to reorder`}
            data-editor-ui
            onPointerDown={(e) => onStartDrag?.(id, e)}
            className="pointer-events-auto flex cursor-grab touch-none items-center justify-center rounded-lg border border-white/20 bg-stone-950/95 p-1.5 text-teal-300 shadow-lg active:cursor-grabbing"
            title="Drag section up/down — hold and move (no Ctrl/Command key)"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        ) : null}

        <button
          type="button"
          data-editor-ui
          onClick={(e) => {
            e.stopPropagation()
            onSelect(id)
          }}
          className={`pointer-events-auto truncate rounded-md border px-2 py-1 font-semibold uppercase tracking-wide shadow-lg transition ${
            isBlock ? 'text-[9px]' : 'rounded-lg px-3 py-1.5 text-xs'
          } ${
            selected
              ? 'border-teal-400/60 bg-teal-600 text-white'
              : 'border-white/20 bg-stone-950/95 text-stone-200 hover:border-teal-400/50 hover:text-teal-100'
          }`}
          title={draggable ? 'Click to select · use ⋮ handle to drag' : 'Click to select'}
        >
          {label}
        </button>

        {draggable && selected ? (
          <div className="pointer-events-auto flex shrink-0 flex-col overflow-hidden rounded-lg border border-white/20 bg-stone-950/95 shadow-lg">
            <button
              type="button"
              data-editor-ui
              aria-label={`Move ${label} up`}
              onClick={(e) => {
                e.stopPropagation()
                onNudge?.(id, 'up')
              }}
              className="border-b border-white/10 p-1 text-stone-300 hover:bg-white/10 hover:text-teal-200"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-editor-ui
              aria-label={`Move ${label} down`}
              onClick={(e) => {
                e.stopPropagation()
                onNudge?.(id, 'down')
              }}
              className="p-1 text-stone-300 hover:bg-white/10 hover:text-teal-200"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Slide-out panel for section settings in full-screen editor. */
export function PageEditorSettingsDrawer({ open, title, onClose, children }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-black/50 transition-opacity duration-200 ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-[71] flex w-full max-w-md flex-col border-l border-white/10 bg-stone-950 shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
        aria-label="Section settings"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400/90">Section settings</p>
            <h2 className="text-sm font-semibold text-stone-100">{title || 'Edit section'}</h2>
          </div>
          <button
            type="button"
            data-editor-ui
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-stone-400 hover:bg-white/5 hover:text-stone-200"
            aria-label="Close settings panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </aside>
    </>
  )
}
