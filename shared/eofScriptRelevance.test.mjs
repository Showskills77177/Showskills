import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  scoreDraftRelevance,
  mergeRelevanceIntoVerdict,
  extractPersonLikeNames,
  EOF_SHORTS_RELEVANCE_VOICE,
} from './eofScriptRelevance.mjs'

const CUCCURELLA_TOPIC =
  'Marc Cuccurella hits back at long-hair criticism — says it is about his autistic son'
const CUCCURELLA_BRIEF = `Headline: Cuccurella responds to long-hair criticism
Story type: quote
Facts:
- Marc Cuccurella hit back at criticism of his long hair
- He said he keeps it for a reason linked to his autistic son
- He claims the hair is not a distraction but a show of support
Stakes: Pride / support vs pitch distraction debate
Hook: Is Cuccurella's look a strength or a problem on the pitch?`

describe('eofScriptRelevance', () => {
  it('exports topic-lock voice that bans cross-sport free-association', () => {
    assert.match(EOF_SHORTS_RELEVANCE_VOICE, /TOPIC LOCK/i)
    assert.match(EOF_SHORTS_RELEVANCE_VOICE, /boxing/i)
    assert.match(EOF_SHORTS_RELEVANCE_VOICE, /nut job/i)
  })

  it('fails Cuccurella hair/son draft that injects Fury / Joshua', () => {
    const draft = `Marc Cuccurella hit back at criticism of his long hair, saying it's about his autistic son. You nut job, he's keeping it for a reason. Cuccurella claims it's not a distraction, but a way to show support. Does his hair give him an edge or create issues on the pitch? Tyson Fury recently questioned Anthony Joshua's pride, showing how sensitive these topics can be. Is Cuccurella's unique look a strength or a weakness? Agree or disagree, his hair is staying, and it's for a cause close to his heart.`

    const v = scoreDraftRelevance(draft, {
      topic: CUCCURELLA_TOPIC,
      deskBrief: CUCCURELLA_BRIEF,
      format: 'quote',
    })
    assert.equal(v.pass, false, JSON.stringify(v))
    assert.ok(
      v.offTopic.some((o) => /fury|joshua/i.test(o.label) || /fury|joshua/i.test(o.id)),
      JSON.stringify(v.offTopic),
    )
    assert.ok(v.reasons.some((r) => /Off-topic|Insults/i.test(r)), JSON.stringify(v.reasons))
  })

  it('passes grounded Cuccurella hair/son commentary without boxing or insults', () => {
    const draft = `Marc Cuccurella hit back at long-hair criticism, saying he keeps it for his autistic son — not for fashion. He claims it is support, not a distraction on the pitch. That is the stake: family pride versus whether the look costs him focus in games. Fair response from Cuccurella, or still a pitch issue? Comment.`

    const v = scoreDraftRelevance(draft, {
      topic: CUCCURELLA_TOPIC,
      deskBrief: CUCCURELLA_BRIEF,
      format: 'quote',
    })
    assert.ok(v.pass, JSON.stringify(v))
    assert.equal(v.offTopic.length, 0, JSON.stringify(v.offTopic))
  })

  it('fails boxing lexeme free-association even without named boxers', () => {
    const draft = `Marc Cuccurella hit back at long-hair criticism tied to his autistic son. He says it is support, not a distraction. This is basically boxing energy — pride fights dressed up as image talk. Buy Cuccurella's claim, or still call the hair a pitch issue? Comment.`

    const v = scoreDraftRelevance(draft, {
      topic: CUCCURELLA_TOPIC,
      deskBrief: CUCCURELLA_BRIEF,
    })
    assert.equal(v.pass, false)
    assert.ok(v.offTopic.some((o) => o.id === 'boxing'), JSON.stringify(v.offTopic))
  })

  it('allows boxing names when they are already in the desk brief', () => {
    const topic = 'Tyson Fury praises footballer work rate after Joshua dig'
    const deskBrief = `Headline: Fury praises football graft after Joshua dig
Facts:
- Tyson Fury commented on Anthony Joshua
- He compared pride and graft to elite footballers
Stakes: Cross-over pride debate (sourced)`

    const draft = `Tyson Fury questioned Anthony Joshua's pride, then praised the graft elite footballers show week after week. That is the stake: boxing pride talk spilling into football work-rate rows. Fair from Fury, or just noise? Comment.`

    const v = scoreDraftRelevance(draft, { topic, deskBrief })
    assert.ok(v.pass, JSON.stringify(v))
  })

  it('fails viewer insult lines', () => {
    const draft = `Jude Bellingham hit back at Thomas Tuchel after Tuchel questioned his display in the heat. You nut job if you think that was disrespect. Bellingham said Tuchel doesn't know that heat. Fair response — or out of line? Comment.`
    const v = scoreDraftRelevance(draft, {
      topic: 'Bellingham responds to Tuchel',
      deskBrief: 'Bellingham hit back at Tuchel over heat comments.',
    })
    assert.equal(v.pass, false)
    assert.ok(v.reasons.some((r) => /Insult/i.test(r)))
  })

  it('extracts person-like names and skips org phrases', () => {
    const names = extractPersonLikeNames(
      'Marc Cuccurella faced Premier League noise after Champions League nights. Tyson Fury chimed in.',
    )
    assert.ok(names.some((n) => /Cuccurella/i.test(n)))
    assert.ok(names.some((n) => /Fury/i.test(n)))
    assert.ok(!names.some((n) => /Premier League/i.test(n)))
  })

  it('merges relevance fail into a soft model pass', () => {
    const rel = scoreDraftRelevance(
      `Marc Cuccurella hit back on the hair row about his autistic son. Then Tyson Fury questioned Anthony Joshua's pride for no reason in this story. Agree or disagree?`,
      { topic: CUCCURELLA_TOPIC, deskBrief: CUCCURELLA_BRIEF },
    )
    assert.equal(rel.pass, false)
    const merged = mergeRelevanceIntoVerdict(
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
      rel,
    )
    assert.equal(merged.pass, false)
    assert.ok(merged.relevance < 6)
    assert.ok(merged.reasons.some((r) => /Off-topic|Named/i.test(r)))
  })
})
