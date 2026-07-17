import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  resolveEofVideoDiskMaterialize,
  resolveEofSceneImageDiskMaterialize,
} from '../backend/api/lib/eofProductionArtifacts.mjs'
import { assertEofCleanPlateImagePath } from '../backend/api/lib/eofProductionVideo.mjs'

describe('ensureEofVideoOnDisk materialize policy', () => {
  it('always refreshes from durable video_base64 even when disk short.mp4 exists', () => {
    // Warm Vercel /tmp holding a prior captioned plate must not win.
    assert.equal(
      resolveEofVideoDiskMaterialize({ diskExists: true, hasDurableBase64: true }),
      'write-durable',
    )
  })

  it('refuses orphan on-disk short.mp4 when durable blob was cleared (mid replace)', () => {
    assert.equal(
      resolveEofVideoDiskMaterialize({ diskExists: true, hasDurableBase64: false }),
      null,
    )
  })

  it('returns null when neither disk nor durable blob exists', () => {
    assert.equal(
      resolveEofVideoDiskMaterialize({ diskExists: false, hasDurableBase64: false }),
      null,
    )
  })
})

describe('ensureEofSceneImageOnDisk materialize policy', () => {
  it('always refreshes from durable scene stills even when disk scene-N.jpg exists', () => {
    // Warm Vercel /tmp holding pre-Rebuild (possibly meme) stills must not win on Replace.
    assert.equal(
      resolveEofSceneImageDiskMaterialize({ diskExists: true, hasDurableBase64: true }),
      'write-durable',
    )
  })

  it('refuses orphan on-disk still when durable stills were cleared (mid rebuild)', () => {
    assert.equal(
      resolveEofSceneImageDiskMaterialize({ diskExists: true, hasDurableBase64: false }),
      null,
    )
  })

  it('returns null when neither disk nor durable still exists', () => {
    assert.equal(
      resolveEofSceneImageDiskMaterialize({ diskExists: false, hasDurableBase64: false }),
      null,
    )
  })
})

describe('assertEofCleanPlateImagePath', () => {
  it('allows still image paths', () => {
    assert.doesNotThrow(() => assertEofCleanPlateImagePath('/tmp/job/scene-1.jpg'))
    assert.doesNotThrow(() => assertEofCleanPlateImagePath('/tmp/job/scene-2.jpeg'))
    assert.doesNotThrow(() => assertEofCleanPlateImagePath('/tmp/job/scene-3.png'))
    assert.doesNotThrow(() => assertEofCleanPlateImagePath('/tmp/job/scene-4.webp'))
  })

  it('refuses a captioned short.mp4 / clip as a remux plate', () => {
    assert.throws(
      () => assertEofCleanPlateImagePath('/tmp/job/short.mp4'),
      /refused a video plate/,
    )
    assert.throws(
      () => assertEofCleanPlateImagePath('/tmp/job/clip-1.mp4'),
      /refused a video plate/,
    )
  })

  it('fails loudly on missing path', () => {
    assert.throws(() => assertEofCleanPlateImagePath(''), /missing/)
  })
})
