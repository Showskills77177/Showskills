import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildYoutubeOAuthConnectUrl,
  defaultYoutubeOAuthRedirectUri,
} from '../backend/api/lib/youtubeConfig.mjs'

describe('youtubeConfig', () => {
  it('builds OAuth connect URL with upload scope', () => {
    const url = buildYoutubeOAuthConnectUrl('client123.apps.googleusercontent.com', 'https://example.com/cb')
    assert.ok(url?.includes('client_id=client123'))
    assert.ok(url?.includes('youtube.upload'))
    assert.ok(url?.includes('access_type=offline'))
  })

  it('default redirect uses SITE_URL when unset', () => {
    const prev = process.env.SITE_URL
    process.env.SITE_URL = 'https://vercelshowskillstesteasynow.online'
    delete process.env.YOUTUBE_REDIRECT_URI
    assert.equal(
      defaultYoutubeOAuthRedirectUri(),
      'https://vercelshowskillstesteasynow.online/api/youtube-oauth-callback',
    )
    if (prev === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = prev
  })
})
