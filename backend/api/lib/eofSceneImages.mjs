import { mkdirSync, existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { runFfmpeg } from './eofFfmpeg.mjs'

const PALETTES = ['0x16162e', '0x1a2e1f', '0x172033', '0x2a1515', '0x1f1a2e']

function paletteForQuery(query, index) {
  const s = String(query || '') + String(index)
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}

/**
 * @param {{ imageQuery: string, outPath: string, index?: number }} opts
 */
export async function fetchEofSceneImage({ imageQuery, outPath, index = 0 }) {
  mkdirSync(dirname(outPath), { recursive: true })
  if (existsSync(outPath)) return { path: outPath, source: 'cache' }

  const query = String(imageQuery || 'football stadium').trim() || 'football'
  const key = (process.env.PEXELS_API_KEY || process.env.EOF_PEXELS_API_KEY || '').trim()

  if (key) {
    try {
      const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`
      const res = await fetch(searchUrl, { headers: { Authorization: key } })
      if (res.ok) {
        const data = await res.json()
        const photo = data.photos?.[0]
        const imgUrl = photo?.src?.portrait || photo?.src?.large || photo?.src?.medium
        if (imgUrl) {
          const imgRes = await fetch(imgUrl)
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer())
            await writeFile(outPath, buf)
            return { path: outPath, source: 'pexels' }
          }
        }
      }
    } catch (e) {
      console.warn('[eof-scene-images] Pexels fetch failed', query, e)
    }
  }

  const color = paletteForQuery(query, index)
  await runFfmpeg(
    ['-y', '-f', 'lavfi', '-i', `color=c=${color}:s=1080x1920:d=1`, '-frames:v', '1', outPath],
    { maxBuffer: 8 * 1024 * 1024 },
  )
  if (!existsSync(outPath)) throw new Error(`Could not create placeholder image for “${query}”.`)
  return { path: outPath, source: key ? 'placeholder' : 'placeholder-no-pexels-key' }
}
