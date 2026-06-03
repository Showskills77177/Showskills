import assert from 'node:assert/strict'
import { mergeHomepageLayout, defaultHomepageLayout } from './homepageLayout.mjs'
import {
  mergeSiteShell,
  defaultSiteShell,
  mergeCompetitionsPageLayout,
  defaultCompetitionsPageLayout,
  defaultLegacyBundleCardLayout,
  defaultShirtGiveawayCardLayout,
} from './sitePageLayout.mjs'

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

const compMarker = `comp-test-${Date.now()}`
const competitions = mergeCompetitionsPageLayout(
  JSON.parse(
    JSON.stringify({
      ...defaultCompetitionsPageLayout(),
      title: compMarker,
      sectionOrder: ['free', 'paid'],
      sections: {
        paid: { ...defaultCompetitionsPageLayout().sections.paid, title: 'Paid column test' },
        free: { ...defaultCompetitionsPageLayout().sections.free, visible: false },
      },
      showFaqLink: false,
      legacyBundleCard: {
        ...defaultLegacyBundleCardLayout(),
        summary: 'Editor summary test',
        headlineGapPx: 18,
        offsets: { imagery: { x: 4, y: 2, scale: 1.05 }, headline: { x: 0, y: 6, scale: 1 } },
      },
      shirtGiveawayCard: {
        ...defaultShirtGiveawayCardLayout(),
        title: 'Editor shirt title',
        stepLabels: ['Step A', '', '', '', ''],
        offsets: { timer: { x: 0, y: 4, scale: 1.1 } },
      },
      offsets: {
        ...defaultCompetitionsPageLayout().offsets,
        paidPrimaryCard: { x: 0, y: 8, scale: 1.02 },
      },
    }),
  ),
)

assert.equal(competitions.title, compMarker)
assert.deepEqual(competitions.sectionOrder, ['free', 'paid'])
assert.equal(competitions.sections.paid.title, 'Paid column test')
assert.equal(competitions.sections.free.visible, false)
assert.equal(competitions.showFaqLink, false)
assert.equal(competitions.legacyBundleCard.summary, 'Editor summary test')
assert.equal(competitions.legacyBundleCard.headlineGapPx, 18)
assert.equal(competitions.legacyBundleCard.offsets.imagery.x, 4)
assert.equal(competitions.shirtGiveawayCard.title, 'Editor shirt title')
assert.equal(competitions.shirtGiveawayCard.stepLabels[0], 'Step A')
assert.equal(competitions.shirtGiveawayCard.offsets.timer.scale, 1.1)
assert.equal(competitions.offsets.paidPrimaryCard.y, 8)

console.log('siteLayoutRoundtrip.test.mjs: ok')
