import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  adaptPlainTextDraftToScenesLocally,
  compressToSceneCaption,
  splitDraftIntoSentences,
  unwrapAdaptJson,
} from './eofSceneAdapt.mjs'

const MESSI_DRAFT = `Lionel Messi is back at the World Cup in 2026, and Argentina look sharper with him pulling the strings. The captain scored twice in the group opener and the fans in Miami went wild. At 38, he's still running the show — dictating tempo, finding space, and making every touch count. Brazil and France will be watching closely before the knockouts. Is this Messi's last World Cup dance, or can he lift it again? Drop your take.`

describe('eofSceneAdapt local split', () => {
  it('splits Messi draft into 4–6 scenes with Messi image queries', () => {
    const script = adaptPlainTextDraftToScenesLocally({
      plainTextDraft: MESSI_DRAFT,
      topic: 'Messi shines at World Cup 2026',
      format: 'news',
    })
    assert.ok(script)
    assert.ok(script.scenes.length >= 4 && script.scenes.length <= 6)
    assert.match(script.scenes[0].caption, /Messi|Argentina/i)
    assert.ok(script.scenes.every((s) => /messi/i.test(s.imageQuery)))
    assert.equal(script.scenes[0].role, 'hook')
    assert.equal(script.scenes[script.scenes.length - 1].role, 'cta')
    assert.equal(script.plainTextDraft, MESSI_DRAFT)
  })

  it('compresses long sentences for captions', () => {
    const long =
      'Lionel Messi scored twice in the group opener and the fans in Miami went absolutely wild for the captain of Argentina at the World Cup'
    const cap = compressToSceneCaption(long, 12)
    assert.ok(cap.split(/\s+/).length <= 12)
  })

  it('unwraps nested script.scenes from Groq JSON', () => {
    const unwrapped = unwrapAdaptJson({
      script: {
        scenes: [{ caption: 'Hook line', imageQuery: 'Messi football' }],
        title: 'Test',
      },
    })
    assert.equal(unwrapped.scenes.length, 1)
    assert.equal(unwrapped.scenes[0].caption, 'Hook line')
  })

  it('returns null for too-short drafts', () => {
    assert.equal(
      adaptPlainTextDraftToScenesLocally({
        plainTextDraft: 'Too short.',
        topic: 'Messi',
      }),
      null,
    )
  })

  it('splitDraftIntoSentences handles em-dash clauses', () => {
    const parts = splitDraftIntoSentences('First beat. Second beat — third clause here.')
    assert.ok(parts.length >= 2)
  })
})
