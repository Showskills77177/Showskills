/** Browser PUT to YouTube resumable upload URL (single or chunked). */

const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024

function networkUploadError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (/load failed|failed to fetch|networkerror|network error/i.test(msg)) {
    return new Error(
      'Could not reach YouTube to upload the video (network error). Use Wi‑Fi, try a smaller MP4, or retry in Chrome on desktop.',
    )
  }
  return err instanceof Error ? err : new Error(msg)
}

async function parseYoutubePutResponse(putRes) {
  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '')
    throw new Error(`YouTube upload failed (${putRes.status}). ${detail.slice(0, 200)}`)
  }
  const ytVideo = await putRes.json().catch(() => ({}))
  if (!ytVideo?.id) throw new Error('YouTube did not return a video ID.')
  return ytVideo
}

/**
 * @param {string} uploadUrl
 * @param {File} file
 * @param {{ contentType?: string, onProgress?: (loaded: number, total: number) => void, chunkBytes?: number }} [opts]
 */
export async function putVideoToYoutubeUploadUrl(uploadUrl, file, opts = {}) {
  const total = file?.size ?? 0
  const type = opts.contentType || file?.type || 'video/mp4'
  const onProgress = opts.onProgress
  const chunkBytes = opts.chunkBytes || DEFAULT_CHUNK_BYTES

  if (!uploadUrl) throw new Error('Missing YouTube upload URL.')
  if (!file || total <= 0) throw new Error('Video file is empty.')

  if (total <= chunkBytes) {
    onProgress?.(0, total)
    let putRes
    try {
      putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': type },
        body: file,
      })
    } catch (e) {
      throw networkUploadError(e)
    }
    onProgress?.(total, total)
    return parseYoutubePutResponse(putRes)
  }

  let offset = 0
  while (offset < total) {
    const end = Math.min(offset + chunkBytes, total) - 1
    const chunk = file.slice(offset, end + 1)
    let putRes
    try {
      putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': type,
          'Content-Length': String(chunk.size),
          'Content-Range': `bytes ${offset}-${end}/${total}`,
        },
        body: chunk,
      })
    } catch (e) {
      throw networkUploadError(e)
    }

    onProgress?.(end + 1, total)

    if (putRes.status === 308) {
      const range = putRes.headers.get('Range')
      const m = range?.match(/bytes=0-(\d+)/)
      offset = m ? Number(m[1]) + 1 : end + 1
      continue
    }

    if (putRes.ok) {
      return parseYoutubePutResponse(putRes)
    }

    const detail = await putRes.text().catch(() => '')
    throw new Error(`YouTube upload failed (${putRes.status}). ${detail.slice(0, 200)}`)
  }

  throw new Error('YouTube upload did not complete.')
}
