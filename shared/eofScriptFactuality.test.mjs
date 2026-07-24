import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  scoreDraftFactuality,
  mergeFactualityIntoVerdict,
  EOF_SHORTS_FACTUALITY_VOICE,
} from './eofScriptFactuality.mjs'

describe('eofScriptFactuality', () => {
  it('exports grounding voice that bans invented news', () => {
    assert.match(EOF_SHORTS_FACTUALITY_VOICE, /Do NOT invent news events/i)
    assert.match(EOF_SHORTS_FACTUALITY_VOICE, /retirement/i)
  })

  it('fails invented Bale comeback when topic has no retirement/comeback news', () => {
    const topic = 'Gareth Bale Wales Real Madrid legacy — greatest Welsh footballer?'
    const deskBrief = `Headline: Gareth Bale Wales Real Madrid legacy
Story type: debate
Facts:
- Bale's Real Madrid years delivered Champions League nights and iconic free-kicks
- Wales fans still argue whether he is the nation's greatest ever
Stakes: Pride and legacy, not a live transfer story
Hook: Was Bale the ceiling for Welsh football?`

    const draft = `Gareth Bale is coming back from retirement and Wales fans are already buzzing about a shock return. The Real Madrid legend supposedly ends his retirement to pull on the red shirt again after years away. That would rewrite the Wales attack overnight and reopen every selection row. Is Bale's comeback the boost Wales need, or a nostalgia trap? Comment.`

    const v = scoreDraftFactuality(draft, { topic, deskBrief, format: 'debate' })
    assert.equal(v.pass, false, JSON.stringify(v))
    assert.ok(
      v.fabricated.some((f) => f.id === 'retirement_comeback'),
      JSON.stringify(v.fabricated),
    )
    assert.ok(v.reasons.some((r) => /comeback from retirement/i.test(r)))
  })

  it('passes grounded Bale legacy commentary without inventing events', () => {
    const topic = 'Gareth Bale Wales Real Madrid legacy — greatest Welsh footballer?'
    const deskBrief = `Headline: Gareth Bale Wales Real Madrid legacy
Facts:
- Champions League nights and free-kicks at Real Madrid
- Wales pride debates still run hot
Stakes: Legacy ranking, not live news`

    const draft = `Gareth Bale's Real Madrid peak still sets the bar for Wales — Champions League nights, free-kicks, and a nation riding every sprint. That is the stake: is he Wales' greatest ever, or do the club years overstate the international ceiling? Pride debates never cool on this one. Put Bale clear top for Wales, or is that nostalgia talking? Comment.`

    const v = scoreDraftFactuality(draft, { topic, deskBrief, format: 'debate' })
    assert.ok(v.pass, JSON.stringify(v))
    assert.equal(v.fabricated.length, 0)
  })

  it('allows comeback language when the desk brief already covers it', () => {
    const topic = 'Gareth Bale hints at coming out of retirement'
    const deskBrief = `Headline: Bale hints at coming out of retirement
Facts:
- Reports say Bale is open to ending retirement
- Wales angle is the main stake`

    const draft = `Gareth Bale is coming back from retirement — according to the desk notes that floated today. Wales fans split hard: pride boost or nostalgia trap after those Real Madrid peaks. Buy the comeback story, or call it noise? Comment.`

    const v = scoreDraftFactuality(draft, { topic, deskBrief, format: 'news' })
    assert.ok(v.pass, JSON.stringify(v))
  })

  it('treats question-framed comeback as opinion, not invented news', () => {
    const topic = 'Gareth Bale Wales Real Madrid legacy'
    const deskBrief = 'Legacy debate only — no live transfer or retirement story.'
    const draft = `Gareth Bale's Real Madrid years still dominate Wales pride debates. Should he come back from retirement and pull on the red shirt again, or leave the legend untouched? That is the only honest stake left. Comment.`

    const v = scoreDraftFactuality(draft, { topic, deskBrief })
    assert.ok(v.pass, JSON.stringify(v))
  })

  it('fails invented sacking when source has no managerial exit', () => {
    const topic = 'Arsenal midfield balance after the weekend'
    const deskBrief = 'Tactical debate on Arsenal midfield press and control. No managerial news.'
    const draft = `Mikel Arteta has been sacked after another midfield mess, and Arsenal are already hunting a replacement. The press never landed and the control vanished. Was the board right to axe him now? Comment.`

    const v = scoreDraftFactuality(draft, { topic, deskBrief })
    assert.equal(v.pass, false)
    assert.ok(v.fabricated.some((f) => f.id === 'sacking_firing'))
  })

  it('merges factuality fail into a soft model pass', () => {
    const fact = scoreDraftFactuality(
      `Gareth Bale is coming back from retirement to shock Wales again after years away from the pitch. Fans are already split on whether nostalgia is driving the noise. Agree with the comeback hype?`,
      {
        topic: 'Gareth Bale Wales legacy debate',
        deskBrief: 'Legacy only — no comeback news.',
      },
    )
    assert.equal(fact.pass, false, JSON.stringify(fact))
    const merged = mergeFactualityIntoVerdict(
      {
        pass: true,
        overall: 8,
        merit: 8,
        interest: 8,
        value: 8,
        reasons: [],
        rewriteHints: [],
        skipped: false,
        judgeProvider: 'openai',
        threshold: 6.5,
      },
      fact,
    )
    assert.equal(merged.pass, false)
    assert.ok(merged.factuality < 6)
    assert.ok(merged.reasons.some((r) => /Invented/i.test(r)))
  })
})
