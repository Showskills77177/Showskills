import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_DEFAULT_VIDEO_EFFECTS,
  EOF_MOTION_EFFECTS,
  EOF_LIGHT_EFFECTS,
  EOF_COLOUR_EFFECTS,
  EOF_EFFECT_PRESETS,
  EOF_EFFECT_STACKING_RULE,
  normalizeEofVideoEffects,
  pickEofVideoEffect,
  resolveEofMotionEffect,
  motionEffectFilterChain,
  lightEffectFilterChain,
  colourEffectFilterChain,
  videoEffectsFilterChain,
  eofVideoEffectIds,
  eofVideoEffectsActive,
  listEofVideoEffects,
  summarizeEofVideoEffects,
} from './eofVideoEffects.mjs'

describe('eofVideoEffects catalog', () => {
  it('ships expected motion / light / colour ids', () => {
    const motion = new Set(EOF_MOTION_EFFECTS.map((e) => e.id))
    const light = new Set(EOF_LIGHT_EFFECTS.map((e) => e.id))
    const colour = new Set(EOF_COLOUR_EFFECTS.map((e) => e.id))
    for (const id of [
      'none',
      'shake_subtle',
      'shake_strong',
      'blur_soft',
      'blur_motion',
      'wave_gentle',
      'wave_rgb',
    ]) {
      assert.ok(motion.has(id), id)
    }
    for (const id of ['none', 'light_leak', 'flash', 'glow_pulse']) {
      assert.ok(light.has(id), id)
    }
    for (const id of [
      'none',
      'cold',
      'warm',
      'contrast_punch',
      'noir',
      'teal_orange',
      'hdr_pop',
      'hdr_glow',
      'hdr_crisp',
    ]) {
      assert.ok(colour.has(id), id)
    }
    assert.ok(EOF_EFFECT_STACKING_RULE.includes('1 motion'))
    assert.equal(listEofVideoEffects().length, motion.size + light.size + colour.size)
  })

  it('presets only fill the three slots', () => {
    for (const p of EOF_EFFECT_PRESETS) {
      if (p.id === 'none') continue
      const n = normalizeEofVideoEffects({ preset: p.id })
      assert.equal(n.motion, p.motion)
      assert.equal(n.light, p.light)
      assert.equal(n.colour, p.colour)
      assert.ok(eofVideoEffectIds(n).length <= 3)
    }
  })
})

describe('normalizeEofVideoEffects', () => {
  it('defaults to all off', () => {
    assert.deepEqual(normalizeEofVideoEffects(null), { ...EOF_DEFAULT_VIDEO_EFFECTS })
    assert.deepEqual(normalizeEofVideoEffects(''), { ...EOF_DEFAULT_VIDEO_EFFECTS })
  })

  it('resolves and clamps unknown ids', () => {
    assert.equal(resolveEofMotionEffect('SHAKE_SUBTLE'), 'shake_subtle')
    assert.equal(resolveEofMotionEffect('nope'), 'none')
    const n = normalizeEofVideoEffects({
      motion: 'shake_strong',
      light: 'bogus',
      colour: 'teal_orange',
    })
    assert.equal(n.motion, 'shake_strong')
    assert.equal(n.light, 'none')
    assert.equal(n.colour, 'teal_orange')
    assert.equal(n.preset, 'none')
  })

  it('accepts legacy effectIds arrays with one per category', () => {
    const n = normalizeEofVideoEffects({
      effectIds: ['shake_subtle', 'shake_strong', 'flash', 'cold', 'warm'],
    })
    assert.equal(n.motion, 'shake_subtle', 'first motion wins')
    assert.equal(n.light, 'flash')
    assert.equal(n.colour, 'cold', 'first colour wins')
  })
})

describe('pickEofVideoEffect stacking', () => {
  it('replaces only the picked category', () => {
    let e = normalizeEofVideoEffects(null)
    e = pickEofVideoEffect(e, 'shake_subtle')
    e = pickEofVideoEffect(e, 'glow_pulse')
    e = pickEofVideoEffect(e, 'noir')
    assert.deepEqual(eofVideoEffectIds(e), ['shake_subtle', 'glow_pulse', 'noir'])
    e = pickEofVideoEffect(e, 'wave_rgb')
    assert.deepEqual(eofVideoEffectIds(e), ['wave_rgb', 'glow_pulse', 'noir'])
    e = pickEofVideoEffect(e, 'none')
    // ambiguous none — last pickEof with category-less 'none' is motion none from MOTION_IDS
    assert.equal(e.motion, 'none')
  })

  it('preset replaces all slots', () => {
    const e = pickEofVideoEffect({ motion: 'wave_rgb', light: 'flash', colour: 'cold' }, 'handheld_warm')
    assert.equal(e.preset, 'handheld_warm')
    assert.equal(e.motion, 'shake_subtle')
    assert.equal(e.light, 'light_leak')
    assert.equal(e.colour, 'warm')
  })
})

describe('ffmpeg filter builders', () => {
  it('builds shake / blur / wave chains', () => {
    const shake = motionEffectFilterChain('shake_subtle')
    assert.ok(shake.some((f) => f.startsWith('crop=')))
    assert.ok(shake.some((f) => f.startsWith('scale=')))
    assert.ok(motionEffectFilterChain('blur_soft').some((f) => f.startsWith('gblur=')))
    assert.ok(motionEffectFilterChain('blur_motion').some((f) => f.startsWith('tmix=')))
    assert.ok(motionEffectFilterChain('wave_gentle').some((f) => f.startsWith('rotate=')))
    assert.ok(motionEffectFilterChain('wave_rgb').some((f) => f.startsWith('rgbashift=')))
    assert.deepEqual(motionEffectFilterChain('none'), [])
  })

  it('builds light and colour chains', () => {
    assert.ok(lightEffectFilterChain('light_leak').some((f) => f.includes('colorbalance')))
    assert.ok(lightEffectFilterChain('flash').some((f) => f.includes('hue=')))
    assert.ok(lightEffectFilterChain('flash').some((f) => f.includes('\\,')))
    assert.ok(colourEffectFilterChain('noir').includes('hue=s=0'))
    assert.ok(colourEffectFilterChain('teal_orange').some((f) => f.includes('colorbalance')))
    assert.ok(colourEffectFilterChain('hdr_pop').some((f) => f.startsWith('curves=')))
    assert.ok(colourEffectFilterChain('hdr_glow').some((f) => f.startsWith('gblur=')))
    assert.ok(colourEffectFilterChain('hdr_crisp').some((f) => f.startsWith('unsharp=')))
    assert.deepEqual(colourEffectFilterChain('none'), [])
  })

  it('HDR looks share the colour slot (no double grade)', () => {
    const e = pickEofVideoEffect({ colour: 'cold' }, 'hdr_pop', 'colour')
    assert.equal(e.colour, 'hdr_pop')
    assert.equal(eofVideoEffectIds(e).filter((id) => id.startsWith('hdr_') || id === 'cold').length, 1)
    const stacked = videoEffectsFilterChain({ motion: 'shake_subtle', colour: 'hdr_crisp', light: 'glow_pulse' })
    assert.ok(stacked.some((f) => f.startsWith('unsharp=')))
    assert.ok(stacked.some((f) => f.startsWith('crop=') || f.startsWith('hue=')))
  })

  it('stacks motion → colour → light in videoEffectsFilterChain', () => {
    const chain = videoEffectsFilterChain({
      motion: 'shake_subtle',
      light: 'glow_pulse',
      colour: 'cold',
    })
    assert.ok(chain.length >= 3)
    const cropIdx = chain.findIndex((f) => f.startsWith('crop='))
    const colorIdx = chain.findIndex((f) => f.includes('colorbalance') || f.startsWith('eq='))
    const hueIdx = chain.findIndex((f) => f.startsWith('hue='))
    assert.ok(cropIdx >= 0 && colorIdx > cropIdx)
    assert.ok(hueIdx > colorIdx)
    assert.ok(eofVideoEffectsActive({ motion: 'blur_soft' }))
    assert.equal(eofVideoEffectsActive(null), false)
    assert.ok(summarizeEofVideoEffects({ motion: 'shake_subtle', colour: 'warm' }).includes('Shake'))
  })
})
