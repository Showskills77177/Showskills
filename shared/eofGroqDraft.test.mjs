import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cleanDraftText } from '../backend/api/lib/eofScriptWriter.mjs'

describe('groq draft cleaning', () => {
  it('strips markdown and Script: prefixes', () => {
    const t = cleanDraftText('```\nScript: Tuchel fires back after the draw.\n```')
    assert.match(t, /Tuchel/)
    assert.doesNotMatch(t, /Script:/i)
  })

  it('unwraps JSON voiceover payloads', () => {
    const t = cleanDraftText(
      JSON.stringify({
        plainTextDraft:
          'Thomas Tuchel opens fire after the draw. England looked flat. The midfield lost the ball too cheap. Fans want answers before the next qualifier. Agree with the boss or not? Comment.',
      }),
    )
    assert.match(t, /Thomas Tuchel/)
    assert.doesNotMatch(t, /plainTextDraft/)
  })

  it('strips sure/here is preamble', () => {
    const t = cleanDraftText(
      "Sure! Here's a Shorts script:\nThomas Tuchel opens fire after the draw. England looked flat in midfield and paid for every loose touch. The dressing room needs a response before the next qualifier night. Agree with the boss? Comment.",
    )
    assert.match(t, /^Thomas Tuchel/)
  })
})
