import { SITE_PAGE_BACKGROUNDS } from './sitePageLayout.mjs'
import { siteDesignThemeRootClass } from './siteDesignThemes.mjs'

/**
 * @param {{ pageBackground?: string, siteDesignTheme?: string } | null | undefined} shell
 */
export function resolveSiteShellClasses(shell) {
  const themeRootClass = siteDesignThemeRootClass(shell?.siteDesignTheme)
  const pageBgClass =
    shell?.pageBackground === SITE_PAGE_BACKGROUNDS.solid ? 'ss-page-bg-solid' : 'ss-page-bg'
  return { themeRootClass, pageBgClass }
}

/**
 * @param {{ pageBackground?: string, siteDesignTheme?: string } | null | undefined} shell
 */
export function resolveSiteShellRootClassName(shell) {
  const { themeRootClass, pageBgClass } = resolveSiteShellClasses(shell)
  return `${themeRootClass} ${pageBgClass} min-h-svh font-sans text-stone-300 antialiased`
}
