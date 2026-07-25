import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import {
  resolveScriptJudgeProvider,
  eofScriptJudgeStatus,
  appendJudgeFeedbackToContext,
} from '../backend/api/lib/eofScriptJudge.mjs'

describe('eofScriptJudge', () => {
  const prev = { ...process.env }

  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in prev)) delete process.env[k]
    }
    Object.assign(process.env, prev)
  })

  it('prefers Claude as second model when Groq wrote', () => {
    process.env.EOF_SCRIPT_JUDGE = 'auto'
    process.env.GROQ_API_KEY = 'g'
    process.env.OPENAI_API_KEY = 'o'
    process.env.ANTHROPIC_API_KEY = 'a'
    delete process.env.XAI_API_KEY
    assert.equal(resolveScriptJudgeProvider('groq'), 'anthropic')
  })

  it('falls back to OpenAI judge when Claude is unset and Groq wrote', () => {
    process.env.EOF_SCRIPT_JUDGE = 'auto'
    process.env.GROQ_API_KEY = 'g'
    process.env.OPENAI_API_KEY = 'o'
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.XAI_API_KEY
    assert.equal(resolveScriptJudgeProvider('groq'), 'openai')
  })

  it('can be turned off', () => {
    process.env.EOF_SCRIPT_JUDGE = 'off'
    process.env.OPENAI_API_KEY = 'o'
    assert.equal(resolveScriptJudgeProvider('groq'), null)
    assert.equal(eofScriptJudgeStatus().enabled, false)
  })

  it('appends rewrite hints into context', () => {
    const next = appendJudgeFeedbackToContext('DESK', {
      pass: false,
      skipped: false,
      reasons: ['Too vague'],
      rewriteHints: ['Name the match'],
      merit: 4,
      interest: 5,
      value: 3,
      threshold: 6.5,
    })
    assert.match(next, /EDITOR JUDGE FEEDBACK/)
    assert.match(next, /Name the match/)
  })
})
