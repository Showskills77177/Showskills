import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isShowSkillsStagingHost,
  shouldBlockSearchIndexingAtBuild,
  shouldBlockSearchIndexingForHost,
  STAGING_ROBOTS_TXT,
} from './stagingSite.mjs'
import { resolvePublicSiteUrlForEmail } from './purchaseConfirmationEmail.mjs'

describe('staging site unlisting', () => {
  it('detects staging host fragment', () => {
    assert.equal(isShowSkillsStagingHost('vercelshowskillstesteasynow.online'), true)
    assert.equal(isShowSkillsStagingHost('https://vercelshowskillstesteasynow.online/account'), true)
    assert.equal(isShowSkillsStagingHost('showskills.co.uk'), false)
    assert.equal(isShowSkillsStagingHost('localhost'), false)
  })

  it('blocks search indexing for staging host only', () => {
    assert.equal(shouldBlockSearchIndexingForHost('vercelshowskillstesteasynow.online'), true)
    assert.equal(shouldBlockSearchIndexingForHost('showskills.co.uk'), false)
  })

  it('enables build-time noindex for staging branch or SITE_URL', () => {
    assert.equal(
      shouldBlockSearchIndexingAtBuild({
        gitRef: 'staging',
        siteUrl: 'https://showskills.co.uk',
      }),
      true,
    )
    assert.equal(
      shouldBlockSearchIndexingAtBuild({
        siteUrl: 'https://vercelshowskillstesteasynow.online',
      }),
      true,
    )
    assert.equal(
      shouldBlockSearchIndexingAtBuild({
        gitRef: 'main',
        siteUrl: 'https://showskills.co.uk',
      }),
      false,
    )
  })

  it('maps staging URLs to production in public outbound email assets', () => {
    assert.equal(
      resolvePublicSiteUrlForEmail('https://vercelshowskillstesteasynow.online'),
      'https://showskills.co.uk',
    )
  })

  it('ships disallow-all robots body for staging', () => {
    assert.match(STAGING_ROBOTS_TXT, /Disallow: \//)
  })
})
