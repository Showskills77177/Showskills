import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chooseEofThumbnailSceneIndex, EOF_YT_THUMB_WIDTH, EOF_YT_THUMB_HEIGHT } from '../backend/api/lib/eofShortThumbnail.mjs'

describe('eofShortThumbnail', () => {
  it('exports YouTube thumb size', () => {
    assert.equal(EOF_YT_THUMB_WIDTH, 1280)
    assert.equal(EOF_YT_THUMB_HEIGHT, 720)
  })

  it('chooses preferred scene index within bounds', () => {
    const job = { script: { scenes: [{}, {}, {}, {}] } }
    assert.equal(chooseEofThumbnailSceneIndex(job, { preferredIndex: 2 }), 2)
    assert.equal(chooseEofThumbnailSceneIndex(job, { preferredIndex: 99 }), 0)
    assert.equal(chooseEofThumbnailSceneIndex(job, { meta: { thumbnailSceneIndex: 1 } }), 1)
    assert.equal(
      chooseEofThumbnailSceneIndex(
        { script: { scenes: [{}, {}], thumbnailSceneIndex: 1 } },
        {},
      ),
      1,
    )
  })
})
