import { Link } from 'react-router-dom'
import { useAdminTheme } from './AdminThemeContext'

/** Compact theme switcher for the admin header top bar. */
export function AdminThemePicker({ compact = false }) {
  const { themeId, setThemeId, themes, theme } = useAdminTheme()

  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <label className={theme.themePickerBtn}>
          <span className="flex gap-0.5" aria-hidden>
            {theme.swatch.map((color) => (
              <span
                key={color}
                className="h-2.5 w-2.5 rounded-full border border-white/10"
                style={{ backgroundColor: color }}
              />
            ))}
          </span>
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className={theme.themePickerSelect}
            aria-label="Admin panel theme"
          >
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <Link to="/admin/theme" className={theme.themePickerDesignerLink} title="Open theme designer">
          Design
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {themes.map((t) => {
        const active = t.id === themeId
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setThemeId(t.id)}
            className={`rounded-xl border p-4 text-left transition ${
              active
                ? 'border-teal-500/50 bg-teal-950/30 ring-2 ring-teal-500/30'
                : 'border-white/10 bg-stone-900/40 hover:border-white/20 hover:bg-stone-900/60'
            }`}
          >
            <div className="flex gap-1.5">
              {t.swatch.map((color) => (
                <span
                  key={color}
                  className="h-8 flex-1 rounded-md border border-white/10"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
              ))}
            </div>
            <p className="mt-3 font-semibold text-stone-100">{t.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">{t.description}</p>
            {active ? (
              <p className="mt-2 text-xs font-medium text-teal-400">Active</p>
            ) : (
              <p className="mt-2 text-xs text-stone-600">Click to apply</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
