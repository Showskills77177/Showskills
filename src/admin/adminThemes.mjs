/** @typedef {{
 *   id: string
 *   label: string
 *   description: string
 *   swatch: [string, string, string]
 *   cssMod: string
 *   shell: string
 *   header: string
 *   navActive: string
 *   navInactive: string
 *   logoutBtn: string
 *   adminBadge: string
 *   themePickerBtn: string
 *   themePickerSelect: string
 *   themePickerDesignerLink: string
 *   logoMark: string
 *   logoRingOffset: string
 *   loginOuter: string
 *   loginCard: string
 *   loginTitle: string
 *   input: string
 *   inputOtp: string
 *   secondaryBtn: string
 *   checkbox: string
 *   loadingShell: string
 *   emailPreviewChrome: string
 *   emailPreviewToolbar: string
 *   emailPreviewToolbarText: string
 *   emailPreviewToolbarLink: string
 * }} AdminTheme
 */

export const ADMIN_THEME_STORAGE_KEY = 'ss-admin-theme'
/** Staff default — Pitch green matches the public ShowSkills site. */
export const DEFAULT_ADMIN_THEME_ID = 'pitch'

const inputDark =
  'mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40'
const inputOtpDark =
  'mt-1 w-full min-h-[44px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-stone-100 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40'

const inputLight =
  'mt-1 w-full rounded-lg border border-emerald-400/55 bg-white px-3 py-2 text-sm font-medium text-stone-900 placeholder:text-stone-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-emerald-200/80'
const inputOtpLight =
  'mt-1 w-full min-h-[44px] rounded-lg border border-emerald-400/55 bg-white px-3 py-2 text-center font-mono text-lg font-semibold tracking-[0.3em] text-stone-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-emerald-200/80'

/** @type {AdminTheme[]} */
export const ADMIN_THEMES = [
  {
    id: 'pitch',
    label: 'Pitch green',
    description: 'Default — matches the public site with deep pitch green and emerald accents.',
    swatch: ['#071512', '#0f2922', '#34d399'],
    cssMod: 'ss-admin--pitch',
    shell: 'min-h-screen bg-[#071512] text-stone-200',
    header: 'border-b border-emerald-900/35 bg-[#071512]/95 backdrop-blur',
    navActive:
      'rounded-lg border border-emerald-400/45 bg-emerald-950/70 px-3 py-2 text-sm font-bold text-white ring-1 ring-emerald-400/30',
    navInactive:
      'rounded-lg border border-emerald-900/45 px-3 py-2 text-sm font-medium text-white/90 hover:border-emerald-700/55 hover:bg-emerald-950/45 hover:text-white',
    logoutBtn:
      'rounded-lg border border-emerald-900/45 px-3 py-2 text-sm font-medium text-white/90 hover:border-emerald-700/55 hover:bg-emerald-950/45 hover:text-white',
    adminBadge:
      'rounded-lg border border-emerald-800/50 bg-emerald-950/50 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white',
    themePickerBtn:
      'inline-flex items-center gap-1.5 rounded-lg border border-emerald-900/45 bg-emerald-950/35 px-2 py-1.5 hover:border-emerald-700/55 hover:bg-emerald-950/55',
    themePickerSelect: 'cursor-pointer border-0 bg-transparent py-0 pl-0.5 pr-5 text-xs font-semibold text-white focus:outline-none focus:ring-0',
    themePickerDesignerLink:
      'rounded-lg border border-emerald-900/45 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300 hover:border-emerald-600/50 hover:text-emerald-200',
    logoMark: 'bg-white',
    logoRingOffset: 'focus-visible:ring-offset-[#071512]',
    loginOuter: 'relative flex min-h-screen flex-col items-center justify-center bg-[#071512] px-4',
    loginCard: 'w-full max-w-sm rounded-2xl border border-emerald-900/40 bg-[#0a1f19]/90 p-8 shadow-xl shadow-black/40',
    loginTitle: 'text-center text-lg font-semibold text-emerald-50',
    input: inputDark,
    inputOtp: inputOtpDark,
    secondaryBtn:
      'min-h-[44px] rounded-xl border border-emerald-900/40 py-2.5 text-sm font-medium text-stone-200 hover:border-emerald-600/50 hover:text-emerald-100 disabled:opacity-50',
    checkbox: 'h-3.5 w-3.5 rounded border-white/25 bg-black/40 text-emerald-600 focus:ring-emerald-900/40',
    loadingShell: 'flex min-h-screen items-center justify-center bg-[#071512] text-stone-400',
    emailPreviewChrome: 'overflow-hidden rounded-xl border border-emerald-900/35 bg-[#0c1a16]',
    emailPreviewToolbar:
      'flex flex-wrap items-center justify-between gap-2 border-b border-emerald-900/35 bg-black/30 px-3 py-2',
    emailPreviewToolbarText: 'text-xs text-stone-500',
    emailPreviewToolbarLink: 'text-xs font-medium text-emerald-400 underline underline-offset-2 hover:text-emerald-300',
  },
  {
    id: 'dark',
    label: 'Black',
    description: 'Classic dark admin — stone black surfaces and teal accents.',
    swatch: ['#0c0a09', '#1c1917', '#2dd4bf'],
    cssMod: 'ss-admin--dark',
    shell: 'min-h-screen bg-stone-950 text-stone-200',
    header: 'border-b border-white/10 bg-stone-950/95 backdrop-blur',
    navActive:
      'rounded-lg border border-teal-600/45 bg-teal-900/50 px-3 py-2 text-sm font-semibold text-teal-100 ring-1 ring-teal-500/25',
    navInactive:
      'rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-stone-300 hover:border-white/25 hover:bg-white/5 hover:text-stone-100',
    logoutBtn: 'rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-stone-300 hover:bg-white/5',
    adminBadge:
      'rounded-lg border border-white/15 bg-stone-900/50 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-200',
    themePickerBtn:
      'inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-stone-900/40 px-2 py-1.5 hover:bg-white/5',
    themePickerSelect: 'cursor-pointer border-0 bg-transparent py-0 pl-0.5 pr-5 text-xs font-medium text-stone-300 focus:outline-none focus:ring-0',
    themePickerDesignerLink:
      'rounded-lg border border-white/10 px-2 py-1.5 text-xs font-medium text-teal-400 hover:border-teal-600/40 hover:text-teal-300',
    logoMark: 'bg-stone-100',
    logoRingOffset: 'focus-visible:ring-offset-stone-950',
    loginOuter: 'relative flex min-h-screen flex-col items-center justify-center bg-stone-950 px-4',
    loginCard: 'w-full max-w-sm rounded-2xl border border-white/10 bg-stone-900/80 p-8 shadow-xl',
    loginTitle: 'text-center text-lg font-semibold text-stone-100',
    input: inputDark,
    inputOtp: inputOtpDark,
    secondaryBtn:
      'min-h-[44px] rounded-xl border border-white/15 py-2.5 text-sm font-medium text-stone-200 hover:border-teal-600/40 hover:text-teal-100 disabled:opacity-50',
    checkbox: 'h-3.5 w-3.5 rounded border-white/25 bg-black/40 text-teal-600 focus:ring-teal-900/40',
    loadingShell: 'flex min-h-screen items-center justify-center bg-stone-950 text-stone-400',
    emailPreviewChrome: 'overflow-hidden rounded-xl border border-white/10 bg-[#0c1a16]',
    emailPreviewToolbar:
      'flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-2',
    emailPreviewToolbarText: 'text-xs text-stone-500',
    emailPreviewToolbarLink: 'text-xs font-medium text-teal-400 underline underline-offset-2 hover:text-teal-300',
  },
  {
    id: 'light',
    label: 'White',
    description: 'White workspace with darker green panels and strong type.',
    swatch: ['#ffffff', '#a7f3d0', '#0f766e'],
    cssMod: 'ss-admin--light',
    shell: 'min-h-screen bg-white text-stone-900',
    header: 'border-b border-emerald-200/70 bg-white shadow-sm',
    navActive:
      'rounded-lg border border-emerald-500/50 bg-emerald-100 px-3 py-2 text-sm font-bold text-teal-950 ring-1 ring-emerald-400/35',
    navInactive:
      'rounded-lg border border-emerald-300/70 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:border-emerald-400/60 hover:bg-emerald-50 hover:text-stone-950',
    logoutBtn:
      'rounded-lg border border-emerald-400/45 bg-white px-3 py-2 text-sm font-medium text-stone-900 hover:bg-emerald-50',
    adminBadge:
      'rounded-lg border border-emerald-400/50 bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-900',
    themePickerBtn:
      'inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/45 bg-white px-2 py-1.5 hover:bg-emerald-50',
    themePickerSelect: 'cursor-pointer border-0 bg-transparent py-0 pl-0.5 pr-5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-0',
    themePickerDesignerLink:
      'rounded-lg border border-emerald-400/45 px-2 py-1.5 text-xs font-semibold text-teal-800 hover:border-teal-600 hover:text-teal-950',
    logoMark: 'bg-teal-900',
    logoRingOffset: 'focus-visible:ring-offset-white',
    loginOuter: 'relative flex min-h-screen flex-col items-center justify-center bg-white px-4',
    loginCard:
      'w-full max-w-sm rounded-2xl border border-emerald-400/50 bg-emerald-200/75 p-8 shadow-md shadow-emerald-900/12',
    loginTitle: 'text-center text-lg font-bold text-stone-950',
    input: inputLight,
    inputOtp: inputOtpLight,
    secondaryBtn:
      'min-h-[44px] rounded-xl border border-emerald-400/50 bg-white py-2.5 text-sm font-semibold text-stone-900 hover:border-teal-600 hover:bg-emerald-50 disabled:opacity-50',
    checkbox: 'h-3.5 w-3.5 rounded border-emerald-500/50 bg-white text-teal-700 focus:ring-emerald-200',
    loadingShell: 'flex min-h-screen items-center justify-center bg-white text-stone-800 font-medium',
    emailPreviewChrome: 'overflow-hidden rounded-xl border border-emerald-400/45 bg-emerald-200/70',
    emailPreviewToolbar:
      'flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 bg-white px-3 py-2',
    emailPreviewToolbarText: 'text-xs font-medium text-stone-700',
    emailPreviewToolbarLink:
      'text-xs font-semibold text-teal-800 underline underline-offset-2 hover:text-teal-950',
  },
]

/** @param {string} id */
export function getAdminTheme(id) {
  return (
    ADMIN_THEMES.find((t) => t.id === id) ??
    ADMIN_THEMES.find((t) => t.id === DEFAULT_ADMIN_THEME_ID) ??
    ADMIN_THEMES[0]
  )
}

export function readStoredAdminThemeId() {
  try {
    const stored = localStorage.getItem(ADMIN_THEME_STORAGE_KEY)
    if (stored && ADMIN_THEMES.some((t) => t.id === stored)) return stored
  } catch {
    /* private mode */
  }
  return DEFAULT_ADMIN_THEME_ID
}

/** @param {string} id */
export function storeAdminThemeId(id) {
  try {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

/** @param {AdminTheme} theme */
export function adminThemeRootClass(theme) {
  return ['ss-admin', theme.cssMod, theme.shell].filter(Boolean).join(' ')
}
