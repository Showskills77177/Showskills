import { useEffect, useMemo, useState } from 'react'
import {
  ALL_ADMIN_COMPETITIONS,
  GIVEAWAY_COMPETITIONS,
  MAIN_DRAW_COMPETITIONS,
  getAdminCompetitionLabel,
  getGiveawayCompetitionLabel,
  getMainDrawCompetitionLabel,
} from '../../../shared/adminCompetitions.mjs'
import { apiFetch } from '../../lib/api'

const SELECT_CLASS =
  'rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 focus:border-teal-600/50 focus:outline-none'

function labelForKind(kind, slug, dynamicLabels) {
  if (dynamicLabels?.has(slug)) return dynamicLabels.get(slug)
  if (kind === 'mainDraw') return getMainDrawCompetitionLabel(slug)
  if (kind === 'giveaway') return getGiveawayCompetitionLabel(slug)
  return getAdminCompetitionLabel(slug)
}

/**
 * @param {{
 *   kind?: 'mainDraw' | 'giveaway' | 'any',
 *   value: string,
 *   onChange: (value: string) => void,
 *   allowAll?: boolean,
 *   allLabel?: string,
 *   label?: string,
 *   className?: string,
 *   disabled?: boolean,
 * }} props
 */
export function AdminCompetitionSelect({
  kind = 'mainDraw',
  value,
  onChange,
  allowAll = true,
  allLabel = 'All competitions',
  label = 'Competition',
  className = '',
  disabled = false,
}) {
  const [mainDrawOptions, setMainDrawOptions] = useState(null)

  useEffect(() => {
    if (kind !== 'mainDraw' && kind !== 'any') return undefined
    let cancelled = false
    apiFetch('/api/admin/competitions')
      .then((res) => res.json().catch(() => ({})))
      .then((j) => {
        if (cancelled || !Array.isArray(j.competitions)) return
        const rows = j.competitions
          .filter((c) => c.kind !== 'giveaway')
          .map((c) => ({ slug: c.slug, label: c.title || c.slug }))
        if (rows.length) setMainDrawOptions(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [kind])

  const options = useMemo(() => {
    const mainDraw = mainDrawOptions?.length ? mainDrawOptions : MAIN_DRAW_COMPETITIONS
    if (kind === 'mainDraw') return mainDraw
    if (kind === 'giveaway') return GIVEAWAY_COMPETITIONS
    const bySlug = new Map()
    for (const c of mainDraw) bySlug.set(c.slug, c)
    for (const c of GIVEAWAY_COMPETITIONS) bySlug.set(c.slug, c)
    for (const c of ALL_ADMIN_COMPETITIONS) {
      if (!bySlug.has(c.slug)) bySlug.set(c.slug, c)
    }
    return [...bySlug.values()]
  }, [kind, mainDrawOptions])

  const dynamicLabels = useMemo(() => {
    const map = new Map()
    for (const c of mainDrawOptions || []) map.set(c.slug, c.label)
    return map
  }, [mainDrawOptions])

  return (
    <label className={`flex flex-col gap-1.5 text-sm text-stone-400 ${className}`}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={SELECT_CLASS}
      >
        {allowAll ? <option value="">{allLabel}</option> : null}
        {options.map((c) => (
          <option key={c.slug} value={c.slug}>
            {labelForKind(kind, c.slug, dynamicLabels)}
          </option>
        ))}
      </select>
    </label>
  )
}

export function competitionFilterLabel(kind, slug, dynamicLabels) {
  if (!slug) return allCompetitionsLabel(kind)
  return labelForKind(kind, slug, dynamicLabels)
}

export function allCompetitionsLabel(kind = 'mainDraw') {
  if (kind === 'giveaway') return 'All giveaways'
  if (kind === 'any') return 'All routes'
  return 'All main prize draws'
}
