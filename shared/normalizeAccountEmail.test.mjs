import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAccountEmail } from './normalizeAccountEmail.mjs'

test('normalizes gmail dots and plus tags', () => {
  assert.equal(
    normalizeAccountEmail('John.Doe+shop@gmail.com'),
    normalizeAccountEmail('johndoe@gmail.com'),
  )
})

test('normalizes googlemail.com to gmail.com', () => {
  assert.equal(normalizeAccountEmail('user@googlemail.com'), 'user@gmail.com')
})

test('leaves non-gmail addresses unchanged apart from case', () => {
  assert.equal(normalizeAccountEmail('User@Example.COM'), 'user@example.com')
})
