import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  listSecondaryImageSubjects,
  resolveSceneImageSubject,
  defaultSceneImageQuery,
} from './eofSceneImageQueries.mjs'
import { adaptPlainTextDraftToScenesLocally, targetSceneCountForDraft } from './eofSceneAdapt.mjs'

const ROONEY_TUCHEL = `Wayne Rooney just slammed Thomas Tuchel's defensive shape after England lost. According to Rooney on the desk, that midfield never pressed and the back line sat too deep. Tuchel's tactics are under fire again. Was Rooney right about Tuchel, or is that unfair? Comment.`

describe('eof multi-subject + adaptive scenes', () => {
  it('finds Tuchel as secondary when Rooney leads', () => {
    const sec = listSecondaryImageSubjects(
      'Wayne Rooney on Thomas Tuchel England',
      ROONEY_TUCHEL,
    )
    assert.ok(sec.some((s) => /tuchel/i.test(s)), JSON.stringify(sec))
  })

  it('assigns a Tuchel imageQuery on the reserved secondary scene slot', () => {
    const subject = resolveSceneImageSubject({
      topic: 'Wayne Rooney on Thomas Tuchel',
      caption: "Tuchel's tactics are under fire again",
      plainTextDraft: ROONEY_TUCHEL,
      sceneIndex: 1,
      sceneCount: 4,
    })
    assert.match(subject, /tuchel/i)
    assert.match(
      resolveSceneImageSubject({
        topic: 'Wayne Rooney on Thomas Tuchel',
        caption: "Tuchel's tactics are under fire again",
        plainTextDraft: ROONEY_TUCHEL,
        sceneIndex: 0,
        sceneCount: 4,
      }),
      /rooney/i,
    )
  })

  it('adapts short hot takes to 3–5 scenes with a secondary still', () => {
    const { min, max } = targetSceneCountForDraft(ROONEY_TUCHEL)
    assert.ok(min >= 3 && max <= 5)
    const script = adaptPlainTextDraftToScenesLocally({
      plainTextDraft: ROONEY_TUCHEL,
      topic: 'Wayne Rooney on Thomas Tuchel',
      format: 'debate',
    })
    assert.ok(script)
    assert.ok(script.scenes.length >= 3 && script.scenes.length <= 5, script.scenes.length)
    const queries = script.scenes.map((s) => s.imageQuery).join(' | ')
    assert.match(queries, /tuchel/i, queries)
    assert.match(queries, /rooney/i, queries)
    // Most beats stay on Rooney (lead); only one reserved secondary slot for Tuchel.
    const rooneyScenes = script.scenes.filter((s) => /rooney/i.test(s.imageQuery)).length
    assert.ok(rooneyScenes >= script.scenes.length - 1, queries)
  })

  it('pundit Rooney query does not ask for Everton kit action', () => {
    const q = defaultSceneImageQuery('Wayne Rooney on Thomas Tuchel', 0, {
      plainTextDraft: ROONEY_TUCHEL,
      caption: 'Wayne Rooney just slammed Thomas Tuchel',
      sceneCount: 4,
    })
    assert.match(q, /rooney/i)
    assert.match(q, /pundit|studio|sky|presenter|analysis/i)
    assert.doesNotMatch(q, /celebrating|everton kit/i)
  })
})
