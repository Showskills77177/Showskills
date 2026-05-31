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

  it('not qualified quiz email mentions consolation entries when awarded', () => {
    const html = buildQuizResultHtml({
      customerFullName: 'Test',
      allCorrect: false,
      siteUrl: 'https://showskills.co.uk',
      orderRef: 'ORD-2',
      bundleTitle: 'Whale bundle',
      quantity: 40,
      amountPence: 1800,
      ticketNumbers: ['SS-11111111'],
      consolationShirtEntries: 2,
      consolationShirtEntryNumbers: ['SG-AABBCCDD', 'SG-11223344'],
    })
    assert.match(html, /Consolation prize/i)
    assert.match(html, /2 automatic entries/i)
    assert.match(html, /SG-AABBCCDD/)
    assert.match(html, /ronaldo-shirt-giveaway-jersey\.png/)
    assert.match(html, /not refunded/i)
  })

  it('not qualified under £10 email explains no consolation', () => {
    const html = buildQuizResultHtml({
      customerFullName: 'Test',
      allCorrect: false,
      siteUrl: 'https://showskills.co.uk',
      orderRef: 'ORD-3',
      bundleTitle: 'Single ticket',
      quantity: 1,
      amountPence: 750,
      ticketNumbers: ['SS-99999999'],
      consolationShirtEntries: 0,
    })
    assert.doesNotMatch(html, /Consolation prize — Free Ronaldo Shirt Giveaway/)
    assert.match(html, /£10 or more/)
  })

  it('purchase and quiz emails include Trustpilot review invite', () => {
    const purchaseHtml = buildPurchaseConfirmationHtml({
      customerFullName: 'Test',
      bundleTitle: 'Single',
      quantity: 1,
      amountPence: 75,
      ticketNumbers: ['SS-ABCDEF00'],
      purchaseRef: 'ORD-1',
      siteUrl: 'https://showskills.co.uk',
      quizPending: true,
      completeQuizUrl: 'https://showskills.co.uk/?complete-quiz=1&token=abc',
    })
    assert.match(purchaseHtml, /Review us on Trustpilot/i)
    assert.match(purchaseHtml, /trustpilot\.com\/review\/showskills\.co\.uk/)

    const quizHtml = buildQuizResultHtml({
      customerFullName: 'Test',
      allCorrect: true,
      siteUrl: 'https://showskills.co.uk',
      orderRef: 'ORD-1',
      ticketNumbers: ['SS-ABCDEF00'],
    })
    assert.match(quizHtml, /Review us on Trustpilot/i)
  })
})
