import { useMemo, useState } from 'react'
import { EOF } from './eofStudioTheme'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function EofPublishCalendar({ calendar = {}, onSelectDay, selectedDay }) {
  const [monthOffset, setMonthOffset] = useState(0)

  const { year, month, cells } = useMemo(() => buildMonthGrid(monthOffset), [monthOffset])

  return (
    <div className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Publishing calendar</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonthOffset((m) => m - 1)} className={navBtn}>
            ‹
          </button>
          <span className="min-w-[140px] text-center text-sm text-white">
            {new Date(year, month).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" onClick={() => setMonthOffset((m) => m + 1)} className={navBtn}>
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-[#717171]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const count = cell.key ? (calendar[cell.key]?.length || 0) : 0
          const selected = cell.key && cell.key === selectedDay
          const today = cell.key === todayKey()
          return (
            <button
              key={cell.id}
              type="button"
              disabled={!cell.key}
              onClick={() => cell.key && onSelectDay?.(cell.key)}
              className={`relative min-h-[52px] rounded-lg border p-1 text-left transition ${
                !cell.key
                  ? 'border-transparent'
                  : selected
                    ? 'border-[#3ea6ff] bg-[#263850]'
                    : count > 0
                      ? 'border-[#ff0000]/40 bg-[#2a1515] hover:border-[#ff0000]'
                      : today
                        ? 'border-[#3ea6ff]/50 bg-[#1a1a1a]'
                        : 'border-[#303030] bg-[#121212] hover:border-[#3ea6ff]/40'
              }`}
            >
              {cell.day ? (
                <>
                  <span className={`text-xs ${cell.inMonth ? 'text-white' : 'text-[#555]'}`}>{cell.day}</span>
                  {count > 0 ? (
                    <span className="mt-1 block rounded bg-[#ff0000] px-1 text-[10px] font-bold text-white">
                      {count} video{count === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const navBtn = `h-8 w-8 rounded-full ${EOF.btnSecondary} text-sm`

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildMonthGrid(offset) {
  const base = new Date()
  base.setDate(1)
  base.setMonth(base.getMonth() + offset)
  const year = base.getFullYear()
  const month = base.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  let id = 0

  for (let i = 0; i < firstDow; i += 1) {
    cells.push({ id: id++, day: null, key: null, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ id: id++, day, key, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ id: id++, day: null, key: null, inMonth: false })
  }
  return { year, month, cells }
}
