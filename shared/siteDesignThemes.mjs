/** Public site visual themes — chosen in Site editor → Site header & footer. */

export const SITE_DESIGN_THEMES = {
  pitch: 'pitch',
  worldCup2026: 'world_cup_2026',
}

/** @typedef {{ id: string, label: string, description: string, swatch: string[], rootClass: string }} SiteDesignThemeOption */

/** @type {SiteDesignThemeOption[]} */
export const SITE_DESIGN_THEME_OPTIONS = [
  {
    id: SITE_DESIGN_THEMES.worldCup2026,
    label: 'World Cup 2026',
    description:
      'Stadium night sky, trophy gold, and Trionda blues — aligned with the World Cup Ball giveaway and 2026 tournament branding.',
    swatch: ['#060a14', '#0c1a32', '#fbbf24'],
    rootClass: 'ss-site-theme--world-cup-2026',
  },
  {
    id: SITE_DESIGN_THEMES.pitch,
    label: 'Pitch green',
    description: 'Classic ShowSkills — emerald pitch gradient with subtle World Cup gold highlights.',
    swatch: ['#071512', '#0f2922', '#34d399'],
    rootClass: 'ss-site-theme--pitch',
  },
]

/** @param {string | null | undefined} value */
export function normalizeSiteDesignTheme(value) {
  if (value === SITE_DESIGN_THEMES.pitch) return SITE_DESIGN_THEMES.pitch
  if (value === SITE_DESIGN_THEMES.worldCup2026) return SITE_DESIGN_THEMES.worldCup2026
  return SITE_DESIGN_THEMES.worldCup2026
}

/** @param {string | null | undefined} themeId */
export function siteDesignThemeRootClass(themeId) {
  const id = normalizeSiteDesignTheme(themeId)
  const option = SITE_DESIGN_THEME_OPTIONS.find((t) => t.id === id)
  return option?.rootClass || 'ss-site-theme--world-cup-2026'
}

/** @param {string | null | undefined} themeId */
export function siteDesignThemeLabel(themeId) {
  const id = normalizeSiteDesignTheme(themeId)
  return SITE_DESIGN_THEME_OPTIONS.find((t) => t.id === id)?.label || 'World Cup 2026'
}
