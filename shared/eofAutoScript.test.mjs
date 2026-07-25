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
