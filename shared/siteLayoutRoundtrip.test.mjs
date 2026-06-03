import assert from 'node:assert/strict'
import { mergeHomepageLayout, defaultHomepageLayout } from './homepageLayout.mjs'
import { mergeSiteShell, defaultSiteShell } from './sitePageLayout.mjs'

/** Mirrors backend save/load merge — editor changes must survive a round-trip. */
function roundTripHomepage(patch) {
  const saved = mergeHomepageLayout(patch)
  return mergeHomepageLayout(JSON.parse(JSON.stringify(saved)))
}

function roundTripSite(patch) {
  const saved = mergeSiteShell(patch)
  return mergeSiteShell(JSON.parse(JSON.stringify(saved)))
}

const marker = `editor-test-${Date.now()}`
const homepage = roundTripHomepage({
  ...defaultHomepageLayout(),
  blocks: {
    ...defaultHomepageLayout().blocks,
    hero_intro: {
      ...defaultHomepageLayout().blocks.hero_intro,
      brandTitle: marker,
    },
  },
})

assert.equal(homepage.blocks.hero_intro.brandTitle, marker, 'homepage brandTitle survives merge round-trip')

const site = roundTripSite({
  ...defaultSiteShell(),
  headerTagline: marker,
})

assert.equal(site.headerTagline, marker, 'site shell headerTagline survives merge round-trip')

console.log('siteLayoutRoundtrip.test.mjs: ok')
