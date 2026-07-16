import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  autoTuneVideoLook,
  buildXfadeFilterComplex,
  colorGradeFilterChain,
  enhanceFilterChain,
  resolveEofColorGrade,
  resolveEofEnhanceStyle,
  resolveEofTransitionStyle,
  sceneLookFilterChain,
  xfadeNameForTransition,
} from './eofVideoLook.mjs'

describe('eofVideoLook', () => {
  it('defaults auto transition + color + enhance', () => {
    assert.equal(resolveEofTransitionStyle(''), 'auto')
    assert.equal(resolveEofColorGrade(undefined), 'auto')
    assert.equal(resolveEofEnhanceStyle(undefined), 'auto')
  })

  it('tunes news cooler/faster and debate punchier', () => {
    const news = autoTuneVideoLook({ format: 'news', sceneCount: 5 })
    const debate = autoTuneVideoLook({ format: 'debate', sceneCount: 5 })
    assert.equal(news.colorGrade, 'match')
    assert.equal(debate.colorGrade, 'punchy')
    assert.equal(news.enhanceStyle, 'hd')
    assert.equal(debate.enhanceStyle, 'crisp')
    assert.ok(news.transitionSec <= debate.transitionSec)
    assert.ok(news.perCutTransitions.length === 4)
    assert.ok(debate.perCutTransitions.includes('slideleft'))
  })

  it('builds color match filter chain', () => {
    const chain = colorGradeFilterChain('match')
    assert.ok(chain.some((f) => f.startsWith('eq=')))
    assert.deepEqual(colorGradeFilterChain('off'), [])
  })

  it('builds CapCut HD enhance without plastic over-sharpen', () => {
    const hd = enhanceFilterChain('hd')
    assert.ok(hd.some((f) => f.startsWith('hqdn3d=')))
    assert.ok(hd.some((f) => f.startsWith('unsharp=')))
    assert.ok(hd.some((f) => f.startsWith('eq=')))
    assert.deepEqual(enhanceFilterChain('off'), [])
    const stacked = sceneLookFilterChain({ enhanceStyle: 'hd', colorGrade: 'match' })
    assert.ok(stacked[0].startsWith('hqdn3d='))
    assert.ok(stacked.some((f) => f.startsWith('eq=contrast=1.06')))
  })

  it('maps CapCut styles to xfade names', () => {
    assert.equal(xfadeNameForTransition('fadeblack'), 'fadeblack')
    assert.equal(xfadeNameForTransition('cut'), null)
  })

  it('builds xfade graph that preserves total duration math', () => {
    const look = autoTuneVideoLook({ format: 'listicle', sceneCount: 3 })
    const graph = buildXfadeFilterComplex({
      clipDurations: [3, 3, 3],
      perCutTransitions: look.perCutTransitions,
      transitionSec: look.transitionSec,
    })
    assert.ok(graph)
    assert.ok(graph.filterComplex.includes('xfade='))
    assert.equal(graph.outputLabel, 'vout')
    assert.ok(Math.abs(graph.outputDurationSec - 9) < 0.01)
    assert.equal(graph.paddedDurations.length, 3)
    assert.ok(graph.paddedDurations[0] > 3)
    assert.equal(graph.paddedDurations[2], 3)
  })
})
