import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_DEFAULT_STICKERS,
  EOF_MAX_STICKERS,
  EOF_STICKERS_CATALOG,
  EOF_STICKER_POSITIONS,
  EOF_STICKERS_STACKING_RULE,
  normalizeEofStickers,
  pickEofSticker,
  setEofStickerPosition,
  resolveEofStickerPosition,
  planEofStickerOverlays,
  stickerOverlayXY,
  eofStickersActive,
  eofStickerIds,
  summarizeEofStickers,
  listEofStickersByCategory,
  listEofStickersCatalog,
} from './eofStickersElements.mjs'

describe('eofStickersElements catalog', () => {
  it('ships buttons, arrows, shapes, stickers with unique ids', () => {
    const ids = EOF_STICKERS_CATALOG.map((s) => s.id)
    assert.equal(new Set(ids).size, ids.length)
    const cats = new Set(EOF_STICKERS_CATALOG.map((s) => s.category))
    for (const c of ['buttons', 'arrows', 'shapes', 'stickers']) {
      assert.ok(cats.has(c), c)
    }
    for (const id of [
      'btn_subscribe_yt',
      'btn_follow_tt',
      'arrow_left',
      'arrow_right',
      'arrow_up',
      'arrow_down',
      'shape_square',
      'shape_circle',
      'shape_rounded',
      'shape_line',
      'sticker_fire',
      'sticker_new',
      'sticker_tap',
    ]) {
      assert.ok(ids.includes(id), id)
    }
    assert.ok(EOF_STICKERS_STACKING_RULE.includes('3'))
    assert.equal(listEofStickersCatalog().length, EOF_STICKERS_CATALOG.length)
    assert.ok(listEofStickersByCategory('buttons').length >= 2)
    assert.ok(EOF_STICKER_POSITIONS.some((p) => p.id === 'top_right'))
  })
})

describe('normalizeEofStickers', () => {
  it('defaults to none', () => {
    assert.deepEqual(normalizeEofStickers(null), { ...EOF_DEFAULT_STICKERS, items: [] })
    assert.deepEqual(normalizeEofStickers(''), { items: [] })
    assert.equal(eofStickersActive(null), false)
  })

  it('clamps to max 3, drops unknowns, fills default positions', () => {
    const n = normalizeEofStickers({
      items: [
        { id: 'btn_subscribe_yt' },
        { id: 'arrow_right', position: 'upper_third' },
        { id: 'sticker_new', position: 'top_left' },
        { id: 'shape_circle' },
        { id: 'nope' },
      ],
    })
    assert.equal(n.items.length, EOF_MAX_STICKERS)
    assert.deepEqual(eofStickerIds(n), ['btn_subscribe_yt', 'arrow_right', 'sticker_new'])
    assert.equal(n.items[0].position, 'top_right')
    assert.equal(n.items[1].position, 'upper_third')
  })

  it('accepts bare id arrays and JSON strings', () => {
    const n = normalizeEofStickers(['btn_follow_tt', 'shape_line'])
    assert.deepEqual(eofStickerIds(n), ['btn_follow_tt', 'shape_line'])
    const fromJson = normalizeEofStickers(
      JSON.stringify({ elements: [{ id: 'arrow_down', position: 'LOWER_THIRD_SAFE' }] }),
    )
    assert.equal(fromJson.items[0].position, 'lower_third_safe')
  })
})

describe('pickEofSticker / positions', () => {
  it('toggles and caps at 3', () => {
    let s = normalizeEofStickers(null)
    s = pickEofSticker(s, 'btn_subscribe_yt')
    s = pickEofSticker(s, 'arrow_left')
    s = pickEofSticker(s, 'sticker_fire')
    assert.equal(s.items.length, 3)
    s = pickEofSticker(s, 'shape_circle')
    assert.equal(s.items.length, 3)
    assert.ok(eofStickerIds(s).includes('shape_circle'))
    assert.ok(!eofStickerIds(s).includes('btn_subscribe_yt'), 'oldest dropped at cap')
    s = pickEofSticker(s, 'arrow_left')
    assert.ok(!eofStickerIds(s).includes('arrow_left'), 'toggle off')
  })

  it('updates position on selected item', () => {
    let s = pickEofSticker(null, 'btn_subscribe_yt')
    s = setEofStickerPosition(s, 'btn_subscribe_yt', 'top_left')
    assert.equal(s.items[0].position, 'top_left')
    assert.equal(resolveEofStickerPosition('bogus'), 'top_right')
  })
})

describe('overlay plan / XY', () => {
  it('builds filter plan with XY for selected stickers', () => {
    const plan = planEofStickerOverlays({
      items: [
        { id: 'btn_subscribe_yt', position: 'top_right' },
        { id: 'arrow_down', position: 'lower_third_safe' },
      ],
    })
    assert.equal(plan.length, 2)
    assert.equal(plan[0].asset, 'subscribe-yt.png')
    assert.ok(plan[0].x.includes('W-w'))
    assert.ok(plan[1].y.includes('0.58') || plan[1].y.includes('H*'))
    const tr = stickerOverlayXY('top_right')
    assert.ok(tr.x.includes('W-w'))
    assert.ok(summarizeEofStickers({ items: [{ id: 'sticker_new' }] }).includes('NEW'))
    assert.equal(summarizeEofStickers(null), 'Off')
  })
})
