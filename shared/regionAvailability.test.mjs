import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isUkCountryCode,
  paidTicketBundlesAvailable,
  giveawaysAvailableInternationally,
} from './regionAvailability.mjs'
import { t } from './i18n/translate.mjs'
import { SITE_LOCALE_OPTIONS } from './i18n/localeMeta.mjs'

describe('regionAvailability', () => {
  it('treats GB as UK for paid bundles', () => {
    assert.equal(isUkCountryCode('GB'), true)
    assert.equal(paidTicketBundlesAvailable('GB'), true)
    assert.equal(paidTicketBundlesAvailable('US'), false)
  })

  it('keeps giveaways international', () => {
    assert.equal(giveawaysAvailableInternationally(), true)
  })
})

describe('site i18n', () => {
  it('exposes twenty locales', () => {
    assert.equal(SITE_LOCALE_OPTIONS.length, 20)
  })

  it('translates nav labels', () => {
    assert.equal(t('es', 'nav.competitions'), 'Competiciones')
    assert.equal(t('fr', 'nav.home'), 'Accueil')
  })
})
