import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createChallenge, randomInt, solveChallenge } from 'altcha-lib'
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2'
import { deriveHmacKeySecret } from 'altcha-lib/frameworks/express'
import {
  CAPTCHA_BODY_FIELD,
  CAPTCHA_CHALLENGE_PATH,
} from '../shared/captcha.mjs'
import {
  createCaptchaChallengeResponse,
  getCaptchaHmacSecret,
  isCaptchaVerificationRequired,
  verifyCaptchaPayload,
} from '../backend/api/lib/captcha.mjs'

describe('captcha', () => {
  it('exports stable constants', () => {
    assert.equal(CAPTCHA_BODY_FIELD, 'captchaPayload')
    assert.equal(CAPTCHA_CHALLENGE_PATH, '/api/captcha/challenge')
  })

  it('skips verification in E2E mode', async () => {
    const prevE2e = process.env.E2E_MODE
    process.env.E2E_MODE = '1'
    assert.equal(isCaptchaVerificationRequired(), false)
    const result = await verifyCaptchaPayload('')
    assert.equal(result.ok, true)
    assert.equal(result.skipped, true)
    process.env.E2E_MODE = prevE2e
  })

  it('verifies a valid ALTCHA payload', async () => {
    const prevE2e = process.env.E2E_MODE
    const prevSkip = process.env.CAPTCHA_SKIP
    delete process.env.E2E_MODE
    delete process.env.CAPTCHA_SKIP
    process.env.ADMIN_JWT_SECRET = 'unit-test-captcha-secret-at-least-32-chars'

    const secret = getCaptchaHmacSecret()
    const keySecret = await deriveHmacKeySecret(secret)
    const challenge = await createCaptchaChallengeResponse()
    assert.ok(challenge.parameters)
    assert.ok(challenge.signature)

    const solution = await solveChallenge({ challenge, deriveKey })
    assert.ok(solution)
    const payload = Buffer.from(JSON.stringify({ challenge, solution })).toString('base64')
    const verified = await verifyCaptchaPayload(payload)
    assert.equal(verified.ok, true)

    process.env.E2E_MODE = prevE2e
    process.env.CAPTCHA_SKIP = prevSkip
  })

  it('rejects missing payload when verification is required', async () => {
    const prevE2e = process.env.E2E_MODE
    const prevSkip = process.env.CAPTCHA_SKIP
    delete process.env.E2E_MODE
    delete process.env.CAPTCHA_SKIP
    process.env.ADMIN_JWT_SECRET = 'unit-test-captcha-secret-at-least-32-chars'

    const result = await verifyCaptchaPayload('')
    assert.equal(result.ok, false)
    assert.equal(result.code, 'captcha_required')

    process.env.E2E_MODE = prevE2e
    process.env.CAPTCHA_SKIP = prevSkip
  })
})
