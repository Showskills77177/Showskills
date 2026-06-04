import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePublicSocialLinks } from './socialLinks.mjs'

test('footer social links override homepage for shirt form and public UI', () => {
  const links = resolvePublicSocialLinks({
    homepageSocialLinks: {
      facebook: 'https://www.facebook.com/old-homepage-page',
    },
    footerSocialLinks: {
      facebook: 'https://www.facebook.com/share/1ap8Ud8p8X/?mibextid=wwXIfr',
    },
  })
  assert.equal(links.facebook, 'https://www.facebook.com/share/1ap8Ud8p8X/?mibextid=wwXIfr')
})
