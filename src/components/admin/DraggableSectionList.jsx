import { useState } from 'react'
import { GripVertical } from 'lucide-react'
export function DraggableSectionList({ items, onReorder, renderExtra }) {
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  function reorder(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return
    const ids = items.map((i) => i.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, fromId)
    onReorder(next)
  }

  return (
    <ul className="space-y-2" role="list">
      {items.map((item) => {
        const dragging = dragId === item.id
        const over = overId === item.id && dragId !== item.id
        return (
          <li
            key={item.id}
            draggable
            onDragStart={(e) => {
              setDragId(item.id)
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', item.id)
            }}
            onDragEnd={() => {
              setDragId(null)
              setOverId(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setOverId(item.id)
            }}
            onDragLeave={() => {
              if (overId === item.id) setOverId(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const from = e.dataTransfer.getData('text/plain') || dragId
              reorder(from, item.id)
              setDragId(null)
              setOverId(null)
            }}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
              dragging
                ? 'border-teal-500/50 bg-teal-950/30 opacity-60'
                : over
                  ? 'border-teal-400/40 bg-teal-950/20'
                  : 'border-white/10 bg-black/25 hover:border-white/15'
            }`}
          >
            <span
              className="cursor-grab touch-none text-stone-500 active:cursor-grabbing"
              aria-hidden
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-stone-200">{item.label}</span>
            {renderExtra ? renderExtra(item) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function editorInputClass(extra = '') {
  return `w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100 ${extra}`
}

export function EditorField({ label, children }) {
  return (
    <label className="block text-sm text-stone-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}
