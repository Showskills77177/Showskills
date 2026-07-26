import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  scoreDraftRelevance,
  mergeRelevanceIntoVerdict,
  extractPersonLikeNames,
  extractTopicAnchorTokens,
  detectTopicDrift,
  tokensLooselyEqual,
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

  it('fails exact Cuccurella→Keegan topic-drift script even when Keegan is in desk headlines', () => {
    const draft = `Mark Cuccorea's hair is not the focus of any football story here. Kevin Keegan talks about his career highlights, including winning World Player of the Year twice. He also mentions his iconic "I would love it" remark. What's the most iconic moment of Keegan's career - his playing days or his managerial stint with England?`
    const pollutedBrief = `${CUCCURELLA_BRIEF}

Live desk headlines:
1. [BBC Sport] Kevin Keegan on career highlights and I would love it
2. [Sky Sports] Keegan World Player of the Year twice`

    const drift = detectTopicDrift(draft, CUCCURELLA_TOPIC)
    assert.equal(drift.drift, true, JSON.stringify(drift))
    assert.ok(drift.foreign.some((n) => /Keegan/i.test(n)), JSON.stringify(drift.foreign))

    const v = scoreDraftRelevance(draft, {
      topic: CUCCURELLA_TOPIC,
      orderedTopic: CUCCURELLA_TOPIC,
      deskBrief: pollutedBrief,
      format: 'news',
    })
    assert.equal(v.pass, false, JSON.stringify(v))
    assert.equal(v.topicDrift, true)
    assert.ok(
      v.offTopic.some((o) => o.kind === 'topic_drift') || v.reasons.some((r) => /Topic drift/i.test(r)),
      JSON.stringify(v),
    )
    assert.ok(!/Keegan/i.test(draft) || v.pass === false)
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

  it('grounds Marc Cucurella when topic uses Mark Cuccorea typo (adapt must not fail)', () => {
    const topic = "Why Mark Cuccorea doesn't cut his hair"
    const draft = `Marc Cucurella keeps his long hair for a reason tied to family, not fashion. Critics say it is a distraction on the pitch. That is the stake: personal pride versus focus in games. Fair from Cucurella, or still a pitch issue? Comment.`

    const v = scoreDraftRelevance(draft, {
      topic,
      orderedTopic: topic,
      // Adapt path often has empty desk brief — topic anchors alone must ground the hero
      deskBrief: '',
      format: 'news',
      mode: 'adapt',
    })
    assert.ok(v.pass, JSON.stringify(v))
    assert.ok(
      !v.offTopic.some((o) => o.kind === 'ungrounded_name'),
      JSON.stringify(v.offTopic),
    )
    assert.ok(!v.reasons.some((r) => /not grounded/i.test(r)), JSON.stringify(v.reasons))
  })

  it('adapt grounds De Zerbi topic + Lucas Bergvall cast (secondary football name in draft)', () => {
    const topic = 'Roberto di zebri under pressure at Marseille'
    const draft = `Roberto De Zerbi is under pressure at Marseille after another sticky result. Lucas Bergvall has been linked in the chatter around the squad rebuild, but the stake is still De Zerbi's job. Does the board stick with De Zerbi, or blink first? Comment.`

    const v = scoreDraftRelevance(draft, {
      topic,
      orderedTopic: topic,
      deskBrief: '',
      format: 'news',
      mode: 'adapt',
    })
    assert.ok(v.pass, JSON.stringify(v))
    assert.equal(v.topicDrift, false, JSON.stringify(v))
    assert.ok(
      !v.offTopic.some((o) => o.kind === 'ungrounded_name'),
      JSON.stringify(v.offTopic),
    )
    assert.ok(!v.reasons.some((r) => /not grounded|Topic drift/i.test(r)), JSON.stringify(v.reasons))
  })

  it('still blocks Fury when hair topic never mentions boxing', () => {
    const topic = "Why Mark Cuccorea doesn't cut his hair"
    const draft = `Marc Cucurella hit back on the hair row. Then Tyson Fury questioned Anthony Joshua's pride for no reason in this story. Fair from Cucurella? Comment.`

    const v = scoreDraftRelevance(draft, {
      topic,
      orderedTopic: topic,
      deskBrief: '',
      mode: 'adapt',
    })
    assert.equal(v.pass, false, JSON.stringify(v))
    assert.ok(
      v.offTopic.some((o) => /fury|joshua/i.test(o.label) || /fury|joshua/i.test(o.id)),
      JSON.stringify(v.offTopic),
    )
  })

  it('adapt still fails Cucurella→Keegan topic drift', () => {
    const draft = `Mark Cuccorea's hair is not the focus of any football story here. Kevin Keegan talks about his career highlights, including winning World Player of the Year twice. He also mentions his iconic "I would love it" remark. What's the most iconic moment of Keegan's career - his playing days or his managerial stint with England?`
    const v = scoreDraftRelevance(draft, {
      topic: CUCCURELLA_TOPIC,
      orderedTopic: CUCCURELLA_TOPIC,
      deskBrief: '',
      mode: 'adapt',
    })
    assert.equal(v.pass, false, JSON.stringify(v))
    assert.equal(v.topicDrift, true)
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

  it('fuzzy-matches Cuc* surname typos and Marc↔Mark', () => {
    assert.ok(tokensLooselyEqual('Cucurella', 'Cuccorea'))
    assert.ok(tokensLooselyEqual('Cucurella', 'Cuccorella'))
    assert.ok(tokensLooselyEqual('Cucurella', 'Cuccurella'))
    assert.ok(tokensLooselyEqual('Marc', 'Mark'))
    assert.ok(tokensLooselyEqual('zebri', 'zerbi'))
    assert.ok(tokensLooselyEqual('Zerbi', 'zebri'))
    assert.ok(!tokensLooselyEqual('Cucurella', 'Keegan'))
    assert.ok(!tokensLooselyEqual('Fury', 'Cuccorea'))
  })

  it('extracts lowercase De Zerbi surname anchors from typed topics', () => {
    const anchors = extractTopicAnchorTokens('Roberto di zebri under pressure at Marseille')
    assert.ok(anchors.some((a) => /roberto/i.test(a)), JSON.stringify(anchors))
    assert.ok(anchors.some((a) => tokensLooselyEqual(a, 'zerbi')), JSON.stringify(anchors))
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
