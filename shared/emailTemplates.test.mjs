import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPurchaseConfirmationHtml,
  buildPurchaseConfirmationText,
  purchaseConfirmationSubjectQuizPending,
  emailLogoUrl,
  resolvePublicSiteUrlForEmail,
} from './purchaseConfirmationEmail.mjs'
import { buildCompleteQuizUrl } from './quizLinks.mjs'
import { buildQuizResultHtml } from './quizResultEmail.mjs'
import { buildWelcomeEmailHtml, buildCampaignEmailHtml, normalizeCampaignBodyHtml } from './newsletterEmail.mjs'

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

  it('email logo uses public site URL even when siteUrl is localhost', () => {
    assert.equal(emailLogoUrl('http://localhost:5173'), 'https://showskills.co.uk/email/showskills-logo.png')
    assert.equal(resolvePublicSiteUrlForEmail('http://127.0.0.1:3000'), 'https://showskills.co.uk')
  })

  it('newsletter welcome and campaign use branded shell like ticket emails', () => {
    const welcome = buildWelcomeEmailHtml(null, {
      siteUrl: 'https://showskills.co.uk',
      preferencesUrl: 'https://showskills.co.uk/newsletter/preferences?token=x',
      unsubscribeUrl: 'https://showskills.co.uk/newsletter/unsubscribe?token=x',
    })
    assert.match(welcome, /You're on the list/i)
    assert.match(welcome, /showskills-logo\.png/)
    assert.match(welcome, /View competitions/i)

    const campaign = buildCampaignEmailHtml(null, {
      siteUrl: 'https://showskills.co.uk',
      bodyHtml: '<p>Campaign body</p>',
      preferencesUrl: 'https://showskills.co.uk/newsletter/preferences?token=x',
      unsubscribeUrl: 'https://showskills.co.uk/newsletter/unsubscribe?token=x',
    })
    assert.match(campaign, /Campaign body/)
    assert.match(campaign, /Email preferences/i)
    assert.match(campaign, /background:#0c1a16/)
    assert.doesNotMatch(campaign, /Latest updates/i)
    assert.doesNotMatch(campaign, /font-size:22px/)
    assert.doesNotMatch(campaign, /Giveaways &amp; prize draws|Giveaways & prize draws/)
    assert.doesNotMatch(campaign, /alt="ShowSkills Rewards"/)
  })

  it('campaign plain text keeps line breaks and paragraphs', () => {
    const html = buildCampaignEmailHtml(null, {
      siteUrl: 'https://showskills.co.uk',
      bodyHtml: 'Line one\nLine two\n\nSecond paragraph',
    })
    assert.match(html, /Line one<br \/>Line two/)
    assert.match(html, /Second paragraph/)
  })

  it('normalizeCampaignBodyHtml passes HTML through unchanged', () => {
    const raw = '<p style="margin:0;text-align:center">Custom</p>'
    const out = normalizeCampaignBodyHtml(raw)
    assert.match(out, /Custom/)
    assert.match(out, /color:#d6d3d1/)
  })

  it('campaign HTML without color gets light text on dark panel', () => {
    const html = buildCampaignEmailHtml(null, {
      siteUrl: 'https://showskills.co.uk',
      bodyHtml: '<p>Hello world</p>',
    })
    assert.match(html, /Hello world/)
    assert.match(html, /color:#d6d3d1/)
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
