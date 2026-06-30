import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isUkCountryCode,
  paidTicketBundlesAvailable,
  giveawaysAvailableInternationally,
} from './regionAvailability.mjs'
import { localeForCountryCode, resolveGeoSiteLocale } from './i18n/geoLocale.mjs'
import { EN_MESSAGES } from './i18n/locales/en.mjs'
import { SITE_LOCALE_OPTIONS } from './i18n/localeMeta.mjs'

describe('regionAvailability', () => {
  it('treats GB as UK for paid bundles', () => {
    assert.equal(isUkCountryCode('GB'), true)
    assert.equal(paidTicketBundlesAvailable('GB'), true)
    assert.equal(paidTicketBundlesAvailable('US'), false)
    assert.equal(paidTicketBundlesAvailable('NL'), false)
  })

  it('keeps giveaways international', () => {
    assert.equal(giveawaysAvailableInternationally(), true)
  })
})

describe('geoLocale', () => {
  it('maps Netherlands to Dutch', () => {
    assert.equal(localeForCountryCode('NL'), 'nl')
    assert.equal(resolveGeoSiteLocale('NL'), 'nl')
  })

  it('maps UK to English', () => {
    assert.equal(localeForCountryCode('GB'), 'en')
  })

  it('maps France to French', () => {
    assert.equal(localeForCountryCode('FR'), 'fr')
    assert.equal(resolveGeoSiteLocale('FR'), 'fr')
  })
})

describe('coerceOptionalSiteLocale', async () => {
  const { coerceOptionalSiteLocale } = await import('./i18n/localeMeta.mjs')

  it('returns null for empty values instead of defaulting to English', () => {
    assert.equal(coerceOptionalSiteLocale(null), null)
    assert.equal(coerceOptionalSiteLocale(''), null)
    assert.equal(coerceOptionalSiteLocale('fr'), 'fr')
  })
})

describe('site i18n', () => {
  it('exposes twenty locales', () => {
    assert.equal(SITE_LOCALE_OPTIONS.length, 20)
  })

  it('includes core nav keys in English catalog', () => {
    assert.equal(EN_MESSAGES['nav.competitions'], 'Competitions')
    assert.ok(EN_MESSAGES['layout.home.hero_intro.headline'])
  })
})
