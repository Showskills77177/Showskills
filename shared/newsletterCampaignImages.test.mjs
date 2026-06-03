import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCampaignContentLayout,
  normalizeCampaignImageWidth,
  normalizeCampaignImages,
} from './newsletterCampaignImages.mjs'
import { buildCampaignEmailHtml } from './newsletterEmail.mjs'

describe('newsletter campaign images', () => {
  it('normalizes legacy URL strings', () => {
    const images = normalizeCampaignImages(['https://showskills.co.uk/email/x.png'])
    assert.equal(images.length, 1)
    assert.equal(images[0].placement, 'above')
    assert.equal(images[0].width, 472)
  })

  it('places image above body content', () => {
    const html = buildCampaignContentLayout('<p>Body</p>', [
      { url: 'https://example.com/a.jpg', width: 320, placement: 'above' },
    ])
    assert.ok(html.indexOf('example.com/a.jpg') < html.indexOf('Body'))
    assert.match(html, /width="320"/)
  })

  it('places image below body content', () => {
    const html = buildCampaignContentLayout('<p>Body</p>', [
      { url: 'https://example.com/a.jpg', width: 300, placement: 'below' },
    ])
    assert.ok(html.indexOf('Body') < html.indexOf('example.com/a.jpg'))
  })

  it('places image left and right of body using tables', () => {
    const left = buildCampaignContentLayout('<p>Body</p>', [
      { url: 'https://example.com/left.jpg', width: 140, placement: 'left' },
    ])
    assert.match(left, /padding:0 16px 0 0/)
    assert.ok(left.indexOf('left.jpg') < left.indexOf('Body'))

    const right = buildCampaignContentLayout('<p>Body</p>', [
      { url: 'https://example.com/right.jpg', width: 140, placement: 'right' },
    ])
    assert.match(right, /padding:0 0 0 16px/)
    assert.ok(right.indexOf('Body') < right.indexOf('right.jpg'))
  })

  it('clamps side image width', () => {
    assert.equal(normalizeCampaignImageWidth(400, 'left'), 220)
    assert.equal(normalizeCampaignImageWidth(40, 'right'), 80)
  })

  it('buildCampaignEmailHtml includes layout in panel', () => {
    const html = buildCampaignEmailHtml(null, {
      siteUrl: 'https://showskills.co.uk',
      bodyHtml: '<p>Hello</p>',
      campaignImages: [{ url: 'https://example.com/promo.jpg', width: 200, placement: 'left' }],
    })
    assert.match(html, /Hello/)
    assert.match(html, /promo\.jpg/)
    assert.match(html, /width="200"/)
  })
})
