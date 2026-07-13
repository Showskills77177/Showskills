import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveCaptionRenderPlan } from '../backend/api/lib/eofProductionVideo.mjs'

describe('resolveCaptionRenderPlan', () => {
  it('free mode previews ZapCap templates with live subs, never calls ZapCap', () => {
    const plan = resolveCaptionRenderPlan({ captionStyle: 'pop', captionMode: 'free' })
    assert.equal(plan.requestedStyle, 'pop')
    assert.equal(plan.style, 'live')
    assert.equal(plan.engine, 'local')
    assert.equal(plan.burnCaptions, true)
    assert.equal(plan.callZapcap, false)
    assert.equal(plan.forceFreeCaptions, true)
  })

  it('render-video default (free) keeps live/off styles unchanged', () => {
    const live = resolveCaptionRenderPlan({ captionStyle: 'live', captionMode: 'free' })
    assert.equal(live.style, 'live')
    assert.equal(live.callZapcap, false)

    const off = resolveCaptionRenderPlan({ captionStyle: 'off', captionMode: 'free' })
    assert.equal(off.style, 'off')
    assert.equal(off.callZapcap, false)
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
