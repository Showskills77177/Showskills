import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEofOxylabsConfigured,
  extractOxylabsImageRows,
} from '../backend/api/lib/eofOxylabsImages.mjs'

describe('eofOxylabsImages', () => {
  it('reports configured from OXYLABS_USERNAME + OXYLABS_PASSWORD', () => {
    const prevUser = process.env.OXYLABS_USERNAME
    const prevPass = process.env.OXYLABS_PASSWORD
    delete process.env.OXYLABS_USERNAME
    delete process.env.OXYLABS_PASSWORD
    assert.equal(isEofOxylabsConfigured(), false)
    process.env.OXYLABS_USERNAME = 'test-user'
    process.env.OXYLABS_PASSWORD = 'test-pass'
    assert.equal(isEofOxylabsConfigured(), true)
    if (prevUser == null) delete process.env.OXYLABS_USERNAME
    else process.env.OXYLABS_USERNAME = prevUser
    if (prevPass == null) delete process.env.OXYLABS_PASSWORD
    else process.env.OXYLABS_PASSWORD = prevPass
  })

  it('extracts image URLs from Oxylabs organic payload', () => {
    const rows = extractOxylabsImageRows({
      results: [
        {
          content: {
            results: {
              organic: [
                {
                  pos: 1,
                  title: 'Thomas Tuchel England',
                  image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTestThumb&s',
                  link: '/url?q=https://example.com/photo',
                },
                {
                  pos: 2,
                  title: 'Full size',
                  high_res_image: 'https://cdn.example.com/photos/tuchel-england.jpg',
                  image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcOther&s',
                  width: 1200,
                  height: 1600,
                },
              ],
            },
          },
        },
      ],
    })
    assert.ok(rows.length >= 1)
    assert.equal(rows[0].url, 'https://cdn.example.com/photos/tuchel-england.jpg')
    assert.ok(rows.some((r) => r.url.includes('gstatic.com') || r.url.includes('example.com')))
  })
})
