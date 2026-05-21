import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SHOWSKILLS_CONTACT_EMAIL,
  contactTopicLabel,
  isValidContactTopic,
} from './siteContact.mjs'

test('contact email is contact@showskills.co.uk', () => {
  assert.equal(SHOWSKILLS_CONTACT_EMAIL, 'contact@showskills.co.uk')
})

test('contact topics validate', () => {
  assert.equal(contactTopicLabel('cooperation'), 'Cooperation request')
  assert.ok(isValidContactTopic('feedback'))
  assert.ok(!isValidContactTopic('spam'))
})
