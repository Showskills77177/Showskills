import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import {
  autoTuneDraftSettings,
  isAutoScriptMode,
  defaultAutoProviderOrder,
  resolveScriptProviderAttemptOrder,
  preferredEofScriptProvider,
  assembleWriterDeskContext,
  buildDraftPrompt,
  buildPolishPrompt,
  buildHotTakeRefinePrompt,
  scoreLocalScriptGates,
} from '../backend/api/lib/eofScriptWriter.mjs'

describe('eof auto script quality', () => {
  it('detects auto mode', () => {
    assert.equal(isAutoScriptMode('auto'), true)
    assert.equal(isAutoScriptMode(''), true)
    assert.equal(isAutoScriptMode('groq'), false)
  })

  it('tunes cooler for news and warmer for debate', () => {
    const news = autoTuneDraftSettings({ format: 'news' })
    const debate = autoTuneDraftSettings({ format: 'debate' })
    assert.ok(news.draftTemperature < debate.draftTemperature)
    assert.ok(news.excellentMin >= 6)
  })

  it('raises temperature when directed or regenerating', () => {
    const base = autoTuneDraftSettings({ format: 'news' })
    const regen = autoTuneDraftSettings({ format: 'news', regenerate: true })
    const directed = autoTuneDraftSettings({ format: 'news', directorNote: 'Open angry' })
    assert.ok(regen.draftTemperature > base.draftTemperature)
    assert.ok(directed.draftTemperature > base.draftTemperature)
  })
})

describe('eof script provider defaults (Claude first)', () => {
  const prev = { ...process.env }

  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in prev)) delete process.env[k]
    }
    Object.assign(process.env, prev)
  })

  function clearScriptKeys() {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.EOF_ANTHROPIC_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.EOF_GROQ_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.XAI_API_KEY
    delete process.env.EOF_SCRIPT_PROVIDER
    delete process.env.EOF_DEFAULT_SCRIPT_PROVIDER
  }

  it('Auto order prefers Claude when ANTHROPIC_API_KEY is set (even with Groq)', () => {
    clearScriptKeys()
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.GROQ_API_KEY = 'gsk-test'
    process.env.OPENAI_API_KEY = 'sk-test'
    const order = defaultAutoProviderOrder({
      anthropic: true,
      groq: true,
      openai: true,
      xai: false,
    })
    assert.deepEqual(order, ['anthropic', 'groq', 'openai'])
    assert.equal(preferredEofScriptProvider(), 'anthropic')
    assert.deepEqual(resolveScriptProviderAttemptOrder('auto'), ['anthropic', 'groq', 'openai'])
    assert.deepEqual(resolveScriptProviderAttemptOrder(null), ['anthropic', 'groq', 'openai'])
  })

  it('defaults to Claude with only ANTHROPIC_API_KEY (EOF_SCRIPT_PROVIDER unset)', () => {
    clearScriptKeys()
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    assert.equal(preferredEofScriptProvider(), 'anthropic')
    assert.deepEqual(resolveScriptProviderAttemptOrder('auto'), ['anthropic'])
  })

  it('falls back to Groq when Claude is not keyed', () => {
    clearScriptKeys()
    process.env.GROQ_API_KEY = 'gsk-test'
    assert.equal(preferredEofScriptProvider(), 'groq')
    assert.deepEqual(resolveScriptProviderAttemptOrder('auto'), ['groq'])
  })

  it('honours EOF_SCRIPT_PROVIDER force over Auto preference', () => {
    clearScriptKeys()
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.GROQ_API_KEY = 'gsk-test'
    process.env.EOF_SCRIPT_PROVIDER = 'groq'
    assert.equal(preferredEofScriptProvider(), 'groq')
    assert.equal(resolveScriptProviderAttemptOrder(null)[0], 'groq')
  })

  it('agent chat Script AI pick anthropic hits Claude first (even with Groq keyed)', () => {
    clearScriptKeys()
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.GROQ_API_KEY = 'gsk-test'
    assert.deepEqual(resolveScriptProviderAttemptOrder('anthropic')[0], 'anthropic')
    assert.deepEqual(resolveScriptProviderAttemptOrder('claude')[0], 'anthropic')
  })
})

describe('eof writer input bundle', () => {
  it('assembles desk brief + source headlines as primary truth', () => {
    const bundled = assembleWriterDeskContext({
      context: 'Angle: Cuccurella hair row',
      researchBrief: 'Headline: Cuccurella vs fans\nFacts:\n- Hair comments after El Clásico',
      headlinesText: '1. [BBC Sport] Cuccurella hits back at critics',
    })
    assert.match(bundled, /DESK BRIEF \(editor\)/)
    assert.match(bundled, /SOURCE HEADLINES \/ FACTS \(PRIMARY TRUTH/)
    assert.match(bundled, /Cuccurella hits back/)
    assert.match(bundled, /Angle: Cuccurella hair row/)
  })

  it('draft prompt includes FACT LOCK, topic lock, duration, and desk brief', () => {
    const { system, user } = buildDraftPrompt({
      topic: 'Cuccurella hair row after El Clásico',
      format: 'news',
      context: 'SOURCE HEADLINES:\n1. Cuccurella hits back at critics',
    })
    assert.match(system, /HARD FACT LOCK/)
    assert.match(system, /HARD TOPIC LOCK/)
    assert.match(system, /Fury\/Joshua/)
    assert.match(system, /90–130 words/)
    assert.match(user, /## TOPIC/)
    assert.match(user, /## FORMAT \/ DURATION/)
    assert.match(user, /## DESK BRIEF \/ SOURCE FACTS \(PRIMARY TRUTH/)
    assert.match(user, /ONLY claim what is in the DESK BRIEF/)
    assert.match(user, /Cuccurella hits back/)
    assert.match(user, /No agree\/disagree spam/)
  })

  it('agent chat director note keeps topic + desk brief (not generic rewrite)', () => {
    const { system, user } = buildDraftPrompt({
      topic: 'Tuchel England XI selection row',
      format: 'debate',
      context: 'Ordered topic: Tuchel England XI selection row\nSOURCE HEADLINES:\n1. Tuchel names squad amid selection debate',
      previousDraft: 'Old draft about England.',
      directorNote: 'Open angry — name the XI fight — end asking who is wrong',
    })
    assert.match(system, /PRODUCER DIRECTION/)
    assert.match(user, /## PRODUCER DIRECTION/)
    assert.match(user, /Open angry/)
    assert.match(user, /## TOPIC\nTuchel England XI/)
    assert.match(user, /## DESK BRIEF \/ SOURCE FACTS/)
    assert.match(user, /Tuchel names squad/)
    assert.match(user, /CURRENT DRAFT/)
  })

  it('polish and refine prompts keep desk brief + hard locks', () => {
    const polish = buildPolishPrompt({
      topic: 'Salah contract talks',
      format: 'news',
      draft: 'Mo Salah wants a new deal. Will Liverpool pay?',
      deskBrief: 'Facts:\n- Salah contract talks ongoing',
    })
    assert.match(polish.system, /HARD FACT LOCK/)
    assert.match(polish.user, /DESK BRIEF \/ SOURCE FACTS/)
    assert.match(polish.user, /Salah contract talks ongoing/)

    const refine = buildHotTakeRefinePrompt({
      topic: 'Salah contract talks',
      format: 'news',
      draft: 'Mo Salah wants a new deal. Will Liverpool pay?',
      deskBrief: 'Facts:\n- Salah contract talks ongoing',
    })
    assert.match(refine.system, /HARD TOPIC LOCK/)
    assert.match(refine.user, /PRIMARY TRUTH/)
    assert.match(refine.user, /90–130 words/)
  })
})

describe('eof local script gates block topic drift + cross-sport', () => {
  const topic =
    'Marc Cuccurella hits back at long-hair criticism — says it is about his autistic son'
  const brief = `Headline: Cuccurella responds to long-hair criticism
Facts:
- Marc Cuccurella hit back at criticism of his long hair
- He said he keeps it for a reason linked to his autistic son`

  it('rejects exact Keegan pivot even if Keegan headlines pollute the desk brief', () => {
    const draft = `Mark Cuccorea's hair is not the focus of any football story here. Kevin Keegan talks about his career highlights, including winning World Player of the Year twice. He also mentions his iconic "I would love it" remark. What's the most iconic moment of Keegan's career - his playing days or his managerial stint with England?`
    const gates = scoreLocalScriptGates(draft, {
      topic,
      orderedTopic: topic,
      format: 'news',
      deskBrief: `${brief}\n1. [BBC] Kevin Keegan career highlights`,
    })
    assert.equal(gates.pass, false, JSON.stringify(gates.reasons))
    assert.ok(
      gates.reasons.some((r) => /Topic drift|Keegan|Off-topic/i.test(r)),
      JSON.stringify(gates.reasons),
    )
  })

  it('rejects exact Fury/Joshua + nut-job Cuccurella script', () => {
    const draft = `Marc Cuccurella hit back at criticism of his long hair, saying it's about his autistic son. You nut job, he's keeping it for a reason. Cuccurella claims it's not a distraction, but a way to show support. Does his hair give him an edge or create issues on the pitch? Tyson Fury recently questioned Anthony Joshua's pride, showing how sensitive these topics can be. Is Cuccurella's unique look a strength or a weakness? Agree or disagree, his hair is staying, and it's for a cause close to his heart.`
    const gates = scoreLocalScriptGates(draft, {
      topic,
      orderedTopic: topic,
      format: 'quote',
      deskBrief: brief,
    })
    assert.equal(gates.pass, false, JSON.stringify(gates.reasons))
  })

  it('passes Cuccorea typo hair topic when brief has hair/son/criticism', () => {
    const ordered = "Why Mark Cuccorea doesn't cut his hair"
    const draft = `Marc Cucurella finally answered why he will not cut his hair. Critics keep mocking the long locks, but Cucurella says it is tied to his autistic son — a personal reason, not a fashion stunt. That hits back at the pile-on after weeks of online digs. Fair response from Cucurella, or still fair game to joke about the hair? Comment.`
    const gates = scoreLocalScriptGates(draft, {
      topic: ordered,
      orderedTopic: ordered,
      format: 'quote',
      deskBrief: brief,
    })
    assert.equal(gates.pass, true, JSON.stringify(gates.reasons))
    assert.ok(gates.hot.pass, JSON.stringify(gates.hot))
    assert.ok(gates.rel.pass, JSON.stringify(gates.rel))
  })
})

