import { DRAW_COMPETITION_LABEL } from './competitionPeriods.mjs'

export const OLD_POSTAL_COMPETITION_NAME = 'Ronaldo Legacy Bundle — ShowSkills Rewards'
const NEW_POSTAL = `${DRAW_COMPETITION_LABEL} — ShowSkills Rewards`

/** Longest-first string replacements for published copy saved before the rename. */
export const COMPETITION_DISPLAY_NAME_REPLACEMENTS = [
  [OLD_POSTAL_COMPETITION_NAME, NEW_POSTAL],
  ['Signed Football Legacy Bundle details', `${DRAW_COMPETITION_LABEL} details`],
  ['Signed Football Legacy Bundle', DRAW_COMPETITION_LABEL],
  ['Signed Football Legend Bundle details', `${DRAW_COMPETITION_LABEL} details`],
  ['Signed Football Legend Bundle', DRAW_COMPETITION_LABEL],
  ['Ronaldo Legacy Bundle details', `${DRAW_COMPETITION_LABEL} details`],
  ['Ronaldo Legacy Bundle', DRAW_COMPETITION_LABEL],
  ['Legacy Bundle draw', `${DRAW_COMPETITION_LABEL} draw`],
  ['the Legacy Bundle', `the ${DRAW_COMPETITION_LABEL}`],
  ['paid Legacy Bundle', `paid ${DRAW_COMPETITION_LABEL}`],
  ['full Legacy Bundle', `full ${DRAW_COMPETITION_LABEL}`],
  ['main Legacy Bundle', `main ${DRAW_COMPETITION_LABEL}`],
  ['Legacy Bundle', DRAW_COMPETITION_LABEL],
]

export function applyCompetitionDisplayNameReplacements(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  for (const [from, to] of COMPETITION_DISPLAY_NAME_REPLACEMENTS) {
    if (out.includes(from)) out = out.split(from).join(to)
  }
  return out
}

export function migrateCompetitionDisplayNameInJson(value) {
  if (typeof value === 'string') return applyCompetitionDisplayNameReplacements(value)
  if (Array.isArray(value)) return value.map(migrateCompetitionDisplayNameInJson)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, child] of Object.entries(value)) {
      out[key] = migrateCompetitionDisplayNameInJson(child)
    }
    return out
  }
  return value
}
