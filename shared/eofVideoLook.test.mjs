import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  autoTuneVideoLook,
  buildXfadeFilterComplex,
  colorGradeFilterChain,
  resolveEofColorGrade,
  resolveEofTransitionStyle,
  xfadeNameForTransition,
} from './eofVideoLook.mjs'

describe('eofVideoLook', () => {
  it('defaults auto transition + color', () => {
    assert.equal(resolveEofTransitionStyle(''), 'auto')
    assert.equal(resolveEofColorGrade(undefined), 'auto')
  })

  it('tunes news cooler/faster and debate punchier', () => {
    const news = autoTuneVideoLook({ format: 'news', sceneCount: 5 })
    const debate = autoTuneVideoLook({ format: 'debate', sceneCount: 5 })
    assert.equal(news.colorGrade, 'match')
    assert.equal(debate.colorGrade, 'punchy')
    assert.ok(news.transitionSec <= debate.transitionSec)
    assert.ok(news.perCutTransitions.length === 4)
    assert.ok(debate.perCutTransitions.includes('slideleft'))
  })

  it('builds color match filter chain', () => {
    const chain = colorGradeFilterChain('match')
    assert.ok(chain.some((f) => f.startsWith('eq=')))
    assert.deepEqual(colorGradeFilterChain('off'), [])
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
