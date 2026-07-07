import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { runFfmpeg } from './eofFfmpeg.mjs'
import { buildSceneImageSearchQueries } from '../../../shared/eofSceneImageQueries.mjs'
import {
  isPinterestPinUrl,
  fetchPinterestPinImage,
  searchPinterestPartnerPins,
  isEofPinterestApiConfigured,
} from './eofPinterestImages.mjs'
import { isEofGoogleCseConfigured, searchGoogleCseImages } from './eofGoogleImages.mjs'

const PALETTES = ['0x16162e', '0x1a2e1f', '0x172033', '0x2a1515', '0x1f1a2e']

export function isEofPexelsConfigured() {
  return Boolean((process.env.PEXELS_API_KEY || process.env.EOF_PEXELS_API_KEY || '').trim())
}

export function eofImageSourceStatus() {
  return {
    google: isEofGoogleCseConfigured(),
    pexels: isEofPexelsConfigured(),
    pinterestApi: isEofPinterestApiConfigured(),
    pinterestPinUrl: true,
  }
}

export function eofImagesConfigurationNote() {
  const { google, pexels, pinterestApi } = eofImageSourceStatus()
  if (google || pexels || pinterestApi) return null
  return 'Add GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID, PEXELS_API_KEY, and/or PINTEREST_ACCESS_TOKEN on Vercel — or paste a Pinterest pin link per scene.'
}

function paletteForQuery(query, index) {
  const s = String(query || '') + String(index)
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}

async function downloadImageToFile(imgUrl, outPath) {
  const imgRes = await fetch(imgUrl, {
    headers: { 'User-Agent': 'ShowSkills-EOF/1.0' },
  })
  if (!imgRes.ok) return false
  const buf = Buffer.from(await imgRes.arrayBuffer())
  if (buf.length < 8_000) return false
  await writeFile(outPath, buf)
  return true
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

  const pexelsKey = (process.env.PEXELS_API_KEY || process.env.EOF_PEXELS_API_KEY || '').trim()
  const pinterestToken = (process.env.PINTEREST_ACCESS_TOKEN || process.env.EOF_PINTEREST_ACCESS_TOKEN || '').trim()
  const queries = buildSceneImageSearchQueries({ topic, imageQuery, sceneIndex: index })
  const custom = String(imageQuery || '').trim()

  if (custom && isPinterestPinUrl(custom)) {
    try {
      const hit = await fetchPinterestPinImage(custom)
      if (hit && (await downloadImageToFile(hit.imgUrl, outPath))) {
        return {
          path: outPath,
          source: 'pinterest-pin',
          imageQuery: hit.queryUsed,
          pinTitle: hit.title,
        }
      }
    } catch (e) {
      console.warn('[eof-scene-images] Pinterest pin fetch failed', custom, e)
    }
  }

  for (const query of queries) {
    if (isPinterestPinUrl(query)) continue

    if (pexelsKey) {
      try {
        const hit = await searchPexelsPhoto(query, index, pexelsKey)
        if (hit && (await downloadImageToFile(hit.imgUrl, outPath))) {
          return {
            path: outPath,
            source: 'pexels',
            imageQuery: query,
            photographer: hit.photographer,
            pexelsId: hit.pexelsId,
          }
        }
      } catch (e) {
        console.warn('[eof-scene-images] Pexels fetch failed', query, e)
      }
    }

    if (isEofGoogleCseConfigured()) {
      try {
        const hit = await searchGoogleCseImages(query, index)
        if (hit && (await downloadImageToFile(hit.imgUrl, outPath))) {
          return {
            path: outPath,
            source: 'google',
            imageQuery: query,
            imageTitle: hit.title,
            sourcePage: hit.sourcePage,
          }
        }
      } catch (e) {
        console.warn('[eof-scene-images] Google image search failed', query, e)
      }
    }

    if (pinterestToken) {
      try {
        const hit = await searchPinterestPartnerPins(query, index, pinterestToken)
        if (hit && (await downloadImageToFile(hit.imgUrl, outPath))) {
          return {
            path: outPath,
            source: 'pinterest',
            imageQuery: query,
            pinId: hit.pinId,
            pinTitle: hit.title,
          }
        }
      } catch (e) {
        console.warn('[eof-scene-images] Pinterest search failed', query, e)
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

  const hasAnyKey = pexelsKey || pinterestToken || isEofGoogleCseConfigured()
  return {
    path: outPath,
    source: hasAnyKey ? 'placeholder' : 'placeholder-no-image-keys',
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
