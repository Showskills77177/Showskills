import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveCaptionRenderPlan } from '../backend/api/lib/eofProductionVideo.mjs'

describe('resolveCaptionRenderPlan', () => {
  it('free mode burns CapCut shortcuts locally (not collapsed to live)', () => {
    const plan = resolveCaptionRenderPlan({ captionStyle: 'pop', captionMode: 'free' })
    assert.equal(plan.requestedStyle, 'pop')
    assert.equal(plan.style, 'pop')
    assert.equal(plan.engine, 'local')
    assert.equal(plan.burnCaptions, true)
    assert.equal(plan.callZapcap, false)
    assert.equal(plan.forceFreeCaptions, true)
  })

  it('free mode maps catalog zapcap pick to local pop preview', () => {
    const plan = resolveCaptionRenderPlan({ captionStyle: 'zapcap', captionMode: 'free' })
    assert.equal(plan.requestedStyle, 'zapcap')
    assert.equal(plan.style, 'pop')
    assert.equal(plan.engine, 'local')
    assert.equal(plan.callZapcap, false)
  })

  it('free mode keeps karaoke / beast local burns', () => {
    for (const id of ['karaoke', 'beast']) {
      const plan = resolveCaptionRenderPlan({ captionStyle: id, captionMode: 'free' })
      assert.equal(plan.style, id)
      assert.equal(plan.engine, 'local')
      assert.equal(plan.callZapcap, false)
    }
  })

  it('render-video default (free) keeps live/punch/off styles unchanged', () => {
    const live = resolveCaptionRenderPlan({ captionStyle: 'live', captionMode: 'free' })
    assert.equal(live.style, 'live')
    assert.equal(live.engine, 'local')
    assert.equal(live.callZapcap, false)
    assert.equal(live.forceFreeCaptions, false)

    const punch = resolveCaptionRenderPlan({ captionStyle: 'punch', captionMode: 'free' })
    assert.equal(punch.style, 'punch')
    assert.equal(punch.engine, 'local')
    assert.equal(punch.callZapcap, false)

    const off = resolveCaptionRenderPlan({ captionStyle: 'off', captionMode: 'free' })
    assert.equal(off.style, 'off')
    assert.equal(off.callZapcap, false)
  })

  it('free mode burns new subtitle styles locally', () => {
    for (const id of ['classic', 'softbar', 'broadcast', 'desk', 'elegant']) {
      const plan = resolveCaptionRenderPlan({ captionStyle: id, captionMode: 'free' })
      assert.equal(plan.style, id)
      assert.equal(plan.engine, 'local')
      assert.equal(plan.burnCaptions, true)
      assert.equal(plan.callZapcap, false)
    }
  })

  it('zapcap-only mode burns clean plate then ZapCap (apply action)', () => {
    const plan = resolveCaptionRenderPlan({ captionStyle: 'karaoke', captionMode: 'zapcap-only' })
    assert.equal(plan.requestedStyle, 'karaoke')
    assert.equal(plan.style, 'off')
    assert.equal(plan.engine, 'zapcap')
    assert.equal(plan.burnCaptions, false)
    assert.equal(plan.callZapcap, true)
    assert.equal(plan.zapcapOnly, true)
  })

  it('zapcap-only does nothing for non-ZapCap styles', () => {
    const plan = resolveCaptionRenderPlan({ captionStyle: 'live', captionMode: 'zapcap-only' })
    assert.equal(plan.callZapcap, false)
    assert.equal(plan.engine, 'local')
  })
})
