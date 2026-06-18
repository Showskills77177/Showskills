import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultHomepageLayout,
  homeBlockEditorVisible,
  isHomeBlockVisible,
  mergeHomepageLayout,
} from './homepageLayout.mjs'

describe('homepageLayout', () => {
  it('hides opt-in blocks unless visible is explicitly true', () => {
    const layout = defaultHomepageLayout()
    assert.equal(isHomeBlockVisible(layout.blocks.competitions_hub), false)
    assert.equal(isHomeBlockVisible(layout.blocks.winners_panel), false)
    assert.equal(isHomeBlockVisible({ visible: true }), true)
  })

  it('mergeHomepageLayout preserves opt-in visibility rules', () => {
    const merged = mergeHomepageLayout({
      blocks: {
        competitions_hub: { visible: true, title: 'Custom hub' },
        hero_intro: { visible: false },
      },
    })
    assert.equal(merged.blocks.competitions_hub.visible, true)
    assert.equal(merged.blocks.competitions_hub.title, 'Custom hub')
    assert.equal(merged.blocks.hero_intro.visible, false)
    assert.equal(merged.blocks.winners_panel.visible, false)
  })

  it('homeBlockEditorVisible matches editor checkbox state', () => {
    assert.equal(homeBlockEditorVisible({ visible: true }, 'competitions_hub'), true)
    assert.equal(homeBlockEditorVisible({ visible: false }, 'competitions_hub'), false)
    assert.equal(homeBlockEditorVisible({}, 'hero_intro'), true)
    assert.equal(homeBlockEditorVisible({ visible: false }, 'hero_intro'), false)
  })

  it('mergeHomepageLayout appends missing block ids in default order', () => {
    const merged = mergeHomepageLayout({
      blockOrder: ['hero_intro', 'promo_strip'],
    })
    assert.ok(merged.blockOrder.includes('world_cup_ball_panel'))
    assert.ok(merged.blockOrder.indexOf('hero_intro') < merged.blockOrder.indexOf('world_cup_ball_panel'))
  })
})
