import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPurchaseConfirmationHtml,
  buildPurchaseConfirmationText,
  purchaseConfirmationSubjectQuizPending,
} from './purchaseConfirmationEmail.mjs'
import { buildCompleteQuizUrl } from './quizLinks.mjs'
import { buildQuizResultHtml } from './quizResultEmail.mjs'

describe('email templates', () => {
  it('quiz-pending email includes headline, tickets, and CTA link', () => {
    const url = buildCompleteQuizUrl('https://showskills.co.uk', 'a'.repeat(32))
    const html = buildPurchaseConfirmationHtml({
      customerFullName: 'Test',
      bundleTitle: 'Single',
      quantity: 1,
      amountPence: 75,
      ticketNumbers: ['SS-12345678'],
      purchaseRef: 'ORD-TEST',
      siteUrl: 'https://showskills.co.uk',
      quizPending: true,
      completeQuizUrl: url,
    })
    assert.match(html, /Your questions are not answered/i)
    assert.match(html, /Answer your questions now/i)
    assert.match(html, /SS-12345678/)
    assert.ok(html.includes(url.replace(/&/g, '&amp;')) || html.includes(url))

    const text = buildPurchaseConfirmationText({
      customerFullName: 'Test',
      bundleTitle: 'Single',
      quantity: 1,
      amountPence: 75,
      ticketNumbers: ['SS-12345678'],
      purchaseRef: 'ORD-TEST',
      siteUrl: 'https://showskills.co.uk',
      quizPending: true,
      completeQuizUrl: url,
    })
    assert.match(text, /YOUR QUESTIONS ARE NOT ANSWERED/i)
    assert.match(text, /SS-12345678/)
    assert.ok(text.includes(url))

    assert.match(purchaseConfirmationSubjectQuizPending('ORD-X'), /answer your skill questions/i)
  })

  it('completed quiz email has no resume link', () => {
    const html = buildQuizResultHtml({
      customerFullName: 'Test',
      allCorrect: true,
      siteUrl: 'https://showskills.co.uk',
      orderRef: 'ORD-1',
      bundleTitle: 'Single',
      quantity: 1,
      amountPence: 75,
      ticketNumbers: ['SS-ABCDEF00'],
    })
    assert.match(html, /qualify/i)
    assert.doesNotMatch(html, /complete-quiz=1/i)
    assert.doesNotMatch(html, /Your questions are not answered/i)
  })
})
