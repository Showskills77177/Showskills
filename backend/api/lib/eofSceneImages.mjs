import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { runFfmpeg } from './eofFfmpeg.mjs'
import { buildSceneImageSearchQueries } from '../../../shared/eofSceneImageQueries.mjs'

const PALETTES = ['0x16162e', '0x1a2e1f', '0x172033', '0x2a1515', '0x1f1a2e']

export function isEofPexelsConfigured() {
  return Boolean((process.env.PEXELS_API_KEY || process.env.EOF_PEXELS_API_KEY || '').trim())
}

function paletteForQuery(query, index) {
  const s = String(query || '') + String(index)
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}

async function searchPexelsPhoto(query, index, key) {
  const page = Math.floor(index / 12) + 1
  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&page=${page}&orientation=portrait`
  const res = await fetch(searchUrl, { headers: { Authorization: key } })
  if (!res.ok) return null
  const data = await res.json()
  const photos = data.photos || []
  if (!photos.length) return null
  const photo = photos[index % photos.length]
  const imgUrl =
    photo?.src?.large2x || photo?.src?.large || photo?.src?.portrait || photo?.src?.medium || photo?.src?.original
  if (!imgUrl) return null
  return {
    imgUrl,
    photographer: photo.photographer || null,
    pexelsId: photo.id,
    queryUsed: query,
  }
}

/**
 * @param {{ imageQuery: string, topic?: string, outPath: string, index?: number, refresh?: boolean }} opts
 */
export async function fetchEofSceneImage({ imageQuery, topic, outPath, index = 0, refresh = false }) {
  mkdirSync(dirname(outPath), { recursive: true })
  if (!refresh && existsSync(outPath)) {
    return { path: outPath, source: 'cache' }
  }
  if (refresh && existsSync(outPath)) {
    try {
      unlinkSync(outPath)
    } catch {
      /* ignore */
    }
  }

  const key = (process.env.PEXELS_API_KEY || process.env.EOF_PEXELS_API_KEY || '').trim()
  const queries = buildSceneImageSearchQueries({ topic, imageQuery, sceneIndex: index })

  if (key) {
    for (const query of queries) {
      try {
        const hit = await searchPexelsPhoto(query, index, key)
        if (!hit) continue
        const imgRes = await fetch(hit.imgUrl)
        if (!imgRes.ok) continue
        const buf = Buffer.from(await imgRes.arrayBuffer())
        if (buf.length < 8_000) continue
        await writeFile(outPath, buf)
        return {
          path: outPath,
          source: 'pexels',
          imageQuery: query,
          photographer: hit.photographer,
          pexelsId: hit.pexelsId,
        }
      } catch (e) {
        console.warn('[eof-scene-images] Pexels fetch failed', query, e)
      }
    }
  }

  const fallbackQuery = queries[0] || 'football'
  const color = paletteForQuery(fallbackQuery, index)
  await runFfmpeg(
    ['-y', '-f', 'lavfi', '-i', `color=c=${color}:s=1080x1920:d=1`, '-frames:v', '1', outPath],
    { maxBuffer: 8 * 1024 * 1024 },
  )
  if (!existsSync(outPath)) throw new Error(`Could not create image for “${fallbackQuery}”.`)
  return {
    path: outPath,
    source: key ? 'placeholder' : 'placeholder-no-pexels-key',
    imageQuery: fallbackQuery,
  }
}

/** Remove cached scene JPGs so the next video render fetches fresh stock images. */
export function clearEofSceneImageCache(workDir) {
  try {
    for (const name of readdirSync(workDir)) {
      if (/^scene-\d+\.jpg$/i.test(name)) {
        unlinkSync(join(workDir, name))
      }
    }
  } catch {
    /* ignore */
  }
}

export function eofSceneImageAbsPath(workDir, sceneNumber) {
  return join(workDir, `scene-${sceneNumber}.jpg`)
}
