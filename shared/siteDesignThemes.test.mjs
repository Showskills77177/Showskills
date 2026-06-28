import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeSiteShell } from './sitePageLayout.mjs'
import {
  SITE_DESIGN_THEMES,
  normalizeSiteDesignTheme,
  siteDesignThemeRootClass,
} from './siteDesignThemes.mjs'
import { resolveSiteShellClasses } from './siteShellPresentation.mjs'

describe('siteDesignThemes', () => {
  it('normalizes unknown themes to World Cup 2026', () => {
    assert.equal(normalizeSiteDesignTheme('world_cup_2026'), SITE_DESIGN_THEMES.worldCup2026)
    assert.equal(normalizeSiteDesignTheme('invalid'), SITE_DESIGN_THEMES.worldCup2026)
    assert.equal(normalizeSiteDesignTheme(undefined), SITE_DESIGN_THEMES.worldCup2026)
  })

  it('maps themes to root classes', () => {
    assert.equal(siteDesignThemeRootClass(SITE_DESIGN_THEMES.worldCup2026), 'ss-site-theme--world-cup-2026')
    assert.equal(siteDesignThemeRootClass(SITE_DESIGN_THEMES.pitch), 'ss-site-theme--pitch')
  })

  it('persists through site shell merge', () => {
    const shell = mergeSiteShell({ siteDesignTheme: SITE_DESIGN_THEMES.worldCup2026 })
    assert.equal(shell.siteDesignTheme, SITE_DESIGN_THEMES.worldCup2026)
    assert.equal(resolveSiteShellClasses(shell).themeRootClass, 'ss-site-theme--world-cup-2026')
  })

  it('defaults merged shell to World Cup 2026 when theme omitted', () => {
    const shell = mergeSiteShell({ headerTagline: 'Test' })
    assert.equal(shell.siteDesignTheme, SITE_DESIGN_THEMES.worldCup2026)
  })
})
