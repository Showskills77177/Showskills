/** Floating alignment controls — rendered above the selected block so content cannot cover clicks. */
export function EditableDragToolbar({ onCenter, onBetween, onMatchSiblings, onReset }) {
  function stop(e) {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className="ss-editor-drag-toolbar absolute bottom-full left-0 z-[100] mb-1 flex max-w-[min(100vw,20rem)] flex-wrap items-center gap-px rounded border border-white/15 bg-stone-950/95 p-px shadow-lg"
      data-editor-ui
      onPointerDown={stop}
      onPointerDownCapture={stop}
      onClick={stop}
    >
      <ToolbarBtn title="Center horizontally in panel" onClick={() => onCenter('x')}>
        X
      </ToolbarBtn>
      <ToolbarBtn title="Center vertically in panel" onClick={() => onCenter('y')}>
        Y
      </ToolbarBtn>
      <ToolbarBtn title="Center in panel (both axes)" onClick={() => onCenter('both')} accent>
        ·
      </ToolbarBtn>
      <ToolbarBtn title="Center horizontally between neighbours" onClick={() => onBetween('x')}>
        ↔
      </ToolbarBtn>
      <ToolbarBtn title="Center vertically between neighbours" onClick={() => onBetween('y')}>
        ↕
      </ToolbarBtn>
      <ToolbarBtn title="Center between neighbours (both axes)" onClick={() => onBetween('both')} accent>
        ⊡
      </ToolbarBtn>
      <ToolbarBtn title="Match horizontal center with other blocks" onClick={onMatchSiblings}>
        ≡
      </ToolbarBtn>
      <ToolbarBtn title="Reset position" onClick={onReset} muted>
        0
      </ToolbarBtn>
    </div>
  )
}

function ToolbarBtn({ children, title, onClick, accent = false, muted = false }) {
  return (
    <button
      type="button"
      data-editor-ui
      title={title}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
      }}
      className={`min-w-[1.35rem] rounded px-0.5 py-px text-[8px] font-bold leading-none ${
        accent
          ? 'text-teal-300 hover:bg-white/10 hover:text-teal-100'
          : muted
            ? 'text-stone-500 hover:bg-white/10 hover:text-stone-200'
            : 'text-stone-300 hover:bg-white/10 hover:text-teal-200'
      }`}
    >
      {children}
    </button>
  )
}
