import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg } from './eofFfmpeg.mjs'
import { buildSceneImageSearchQueries, scoreImageRelevance } from '../../../shared/eofSceneImageQueries.mjs'
import {
  isPinterestPinUrl,
  fetchPinterestPinImage,
  searchPinterestPartnerPins,
  isEofPinterestApiConfigured,
} from './eofPinterestImages.mjs'
import { isEofGoogleCseConfigured, searchGoogleCseImages } from './eofGoogleImages.mjs'
import { searchWikimediaCommonsImages } from './eofWikimediaImages.mjs'
import {
  isEofApImagesConfigured,
  searchApMediaPicture,
  downloadApRenditionToFile,
} from './eofApImages.mjs'

const PALETTES = ['0x1e3a5f', '0x1a4d3e', '0x3d2a1a', '0x2a1f4d', '0x4a1f2a']

export function isEofPexelsConfigured() {
  return Boolean((process.env.PEXELS_API_KEY || process.env.EOF_PEXELS_API_KEY || '').trim())
}

export function eofImageSourceStatus() {
  return {
    ap: isEofApImagesConfigured(),
    google: isEofGoogleCseConfigured(),
    pexels: isEofPexelsConfigured(),
    pinterestApi: isEofPinterestApiConfigured(),
    pinterestPinUrl: true,
    wikimedia: true,
  }
}

export function eofImagesConfigurationNote() {
  const { ap, google, pexels, pinterestApi } = eofImageSourceStatus()
  if (pinterestApi || ap || google || pexels) return null
  return 'Using free Wikimedia Commons images. Add PINTEREST_ACCESS_TOKEN (or AP_MEDIA_API_KEY / PEXELS / Google CSE) for better topic photos.'
}

function paletteForQuery(query, index) {
  const s = String(query || '') + String(index)
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}

function looksLikeImageBuffer(buf) {
  if (!buf || buf.length < 24) return false
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  // WebP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true
  // GIF
  if (buf.toString('ascii', 0, 3) === 'GIF') return true
  return false
}

async function downloadImageToFile(imgUrl, outPath) {
  const imgRes = await fetch(imgUrl, {
    headers: {
      'User-Agent': 'ShowSkillsEOF/1.0 (https://showskills.co.uk; eof-production@showskills.co.uk)',
      Accept: 'image/*,*/*',
    },
  })
  if (!imgRes.ok) return false
  const buf = Buffer.from(await imgRes.arrayBuffer())
  if (buf.length < 8_000) return false
  if (!looksLikeImageBuffer(buf)) return false
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

async function writeLabeledPlaceholder({ outPath, color, label }) {
  const safe = String(label || 'Football')
    .replace(/[\\:[\]'=,;]/g, ' ')
    .trim()
    .slice(0, 42)
  const text = safe || 'Football'
  const fontCandidates = [
    process.env.EOF_CAPTION_FONT,
    join(dirname(fileURLToPath(import.meta.url)), '../../../assets/fonts/EofCaptionBold.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  ].filter(Boolean)
  const font = fontCandidates.find((p) => existsSync(p))
  const vf = font
    ? `drawtext=fontfile='${font.replace(/'/g, "'\\''")}':text='${text}':fontsize=54:fontcolor=white:borderw=4:bordercolor=black@0.55:x=(w-text_w)/2:y=(h-text_h)/2`
    : null
  const args = ['-y', '-f', 'lavfi', '-i', `color=c=${color}:s=1080x1920:d=1`]
  if (vf) args.push('-vf', vf)
  args.push('-frames:v', '1', outPath)
  await runFfmpeg(args, { maxBuffer: 8 * 1024 * 1024 })
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

    // AP editorial first — newest-first + topic-ranked (best for “latest Tuchel” etc.)
    if (isEofApImagesConfigured()) {
      try {
        const hit = await searchApMediaPicture(query, index, { topic })
        if (hit) {
          const score =
            typeof hit.relevance === 'number'
              ? hit.relevance
              : scoreImageRelevance(topic || query, hit.title || '')
          if (score >= 0 && (await downloadApRenditionToFile(hit, outPath))) {
            return {
              path: outPath,
              source: 'ap',
              imageQuery: query,
              imageTitle: hit.title,
              apItemId: hit.apItemId,
              apRole: hit.role,
              relevance: score,
            }
          }
        }
      } catch (e) {
        console.warn('[eof-scene-images] AP Images fetch failed', query, e instanceof Error ? e.message : e)
      }
    }

    if (isEofGoogleCseConfigured()) {
      try {
        const hit = await searchGoogleCseImages(query, index)
        if (hit) {
          const score = scoreImageRelevance(topic || query, `${hit.title || ''} ${hit.sourcePage || ''}`)
          if (score >= 4 && (await downloadImageToFile(hit.imgUrl, outPath))) {
            return {
              path: outPath,
              source: 'google',
              imageQuery: query,
              imageTitle: hit.title,
              sourcePage: hit.sourcePage,
              relevance: score,
            }
          }
        }
      } catch (e) {
        console.warn('[eof-scene-images] Google image search failed', query, e)
      }
    }

    // Pinterest after editorial sources — often old fan pins / memes
    if (pinterestToken) {
      try {
        const hit = await searchPinterestPartnerPins(query, index, pinterestToken, { topic })
        if (hit && (hit.relevance ?? 0) >= 4 && (await downloadImageToFile(hit.imgUrl, outPath))) {
          return {
            path: outPath,
            source: 'pinterest',
            imageQuery: query,
            pinId: hit.pinId,
            pinTitle: hit.title,
            relevance: hit.relevance,
          }
        }
      } catch (e) {
        console.warn('[eof-scene-images] Pinterest search failed', query, e)
      }
    }

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

    // Free keyless fallback — real photos from Wikimedia Commons
    try {
      const hit = await searchWikimediaCommonsImages(query, index)
      if (hit) {
        const score = scoreImageRelevance(topic || query, hit.title || '')
        if (score >= 4 && (await downloadImageToFile(hit.imgUrl, outPath))) {
          return {
            path: outPath,
            source: 'wikimedia',
            imageQuery: query,
            imageTitle: hit.title,
            relevance: score,
          }
        }
      }
    } catch (e) {
      console.warn('[eof-scene-images] Wikimedia fetch failed', query, e)
    }
  }

  const fallbackQuery = queries[0] || String(topic || 'football')
  const color = paletteForQuery(fallbackQuery, index)
  await writeLabeledPlaceholder({
    outPath,
    color,
    label: String(topic || fallbackQuery).split(/\s+/).slice(0, 3).join(' '),
  })
  if (!existsSync(outPath)) throw new Error(`Could not create image for “${fallbackQuery}”.`)

  const hasAnyKey = isEofApImagesConfigured() || pexelsKey || pinterestToken || isEofGoogleCseConfigured()
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
