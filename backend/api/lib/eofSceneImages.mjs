import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs'
import { writeFile, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg } from './eofFfmpeg.mjs'
import {
  buildSceneImageSearchQueries,
  scoreImageRelevance,
  resolveImageSubject,
  anchorSceneImageQuery,
  hitMentionsSubject,
  isNamedFootballSubject,
  listSecondaryImageSubjects,
  personMentionedInText,
} from '../../../shared/eofSceneImageQueries.mjs'
import {
  isPinterestPinUrl,
  fetchPinterestPinImage,
  searchPinterestPartnerPins,
  getEofPinterestAccessToken,
} from './eofPinterestImages.mjs'
import { isEofGoogleCseConfigured, searchGoogleCseImages } from './eofGoogleImages.mjs'
import { searchWikimediaCommonsImages, listWikimediaPersonImages } from './eofWikimediaImages.mjs'
import {
  isEofApImagesConfigured,
  searchApMediaPicture,
  downloadApRenditionToFile,
} from './eofApImages.mjs'
import { isEofOxylabsConfigured, claimOxylabsPoolHit } from './eofOxylabsImages.mjs'
import { isEofSerpApiConfigured } from './eofSerpApiImages.mjs'
import {
  isEofPexelsConfigured,
  eofImageSourceStatus,
  eofImagesConfigurationNote,
} from './eofImageSourceStatus.mjs'

export { isEofPexelsConfigured, eofImageSourceStatus, eofImagesConfigurationNote }

const PALETTES = ['0x1e3a5f', '0x1a4d3e', '0x3d2a1a', '0x2a1f4d', '0x4a1f2a']

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

const IMAGE_DOWNLOAD_TIMEOUT_MS = Number(process.env.EOF_IMAGE_DOWNLOAD_TIMEOUT_MS) || 12_000
/** Hard cap per scene so AP/CSE/Pexels waterfalls cannot freeze Rebuild. */
const SCENE_IMAGE_DEADLINE_MS = Number(process.env.EOF_SCENE_IMAGE_DEADLINE_MS) || 35_000

async function withSceneDeadline(promise, label) {
  const limit = Math.max(5_000, SCENE_IMAGE_DEADLINE_MS)
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(limit / 1000)}s`))
    }, limit)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function downloadImageToFile(imgUrl, outPath) {
  const headers = {
    // Browser-like UA — many news CDNs (and Google SERP hosts) reject bot UAs.
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/jpeg,image/*,*/*;q=0.8',
  }
  const url = String(imgUrl || '')
  // pinimg CDN often rejects hotlinks without a Pinterest Referer
  if (url.includes('pinimg.com') || url.includes('pinterest.')) {
    headers.Referer = 'https://www.pinterest.com/'
  } else if (url.includes('wikimedia.org') || url.includes('wikipedia.org')) {
    headers.Referer = 'https://commons.wikimedia.org/'
    headers['User-Agent'] = 'ShowSkillsEOF/1.0 (https://showskills.co.uk; eof-production@showskills.co.uk)'
  } else {
    // Oxylabs / Google Images / news wire stills
    headers.Referer = 'https://www.google.com/'
  }

  const tryOnce = async (target) => {
    try {
      const imgRes = await fetch(target, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS),
      })
      if (!imgRes.ok) {
        console.warn('[eof-scene-images] image download failed', imgRes.status, String(target).slice(0, 140))
        return false
      }
      const buf = Buffer.from(await imgRes.arrayBuffer())
      if (buf.length < 8_000) {
        console.warn('[eof-scene-images] image too small', buf.length, String(target).slice(0, 100))
        return false
      }
      if (!looksLikeImageBuffer(buf)) {
        console.warn('[eof-scene-images] not an image buffer', String(target).slice(0, 100))
        return false
      }
      await writeFile(outPath, buf)
      return true
    } catch (e) {
      const aborted = e?.name === 'AbortError' || e?.name === 'TimeoutError'
      console.warn(
        '[eof-scene-images] image download',
        aborted ? 'timed out' : 'error',
        String(target).slice(0, 120),
        aborted ? '' : e instanceof Error ? e.message : e,
      )
      return false
    }
  }

  if (await tryOnce(url)) return true
  // Commons sometimes serves thumb URLs that 429; retry original path if present
  if (url.includes('/thumb/')) {
    const original = url.replace(/\/thumb\/(.*?\/.*?)\/\d+px-[^/]+$/, '/$1')
    if (original !== url) return tryOnce(original)
  }
  return false
}

/** Prefer local AI-gen stills; otherwise download remote URL (skip file://). */
async function materializeClaimedHit(claimed, outPath) {
  const local = String(claimed?.localPath || '').trim()
  if (local && existsSync(local)) {
    mkdirSync(dirname(outPath), { recursive: true })
    await copyFile(local, outPath)
    return true
  }
  const url = String(claimed?.imgUrl || '').trim()
  if (!url || url.startsWith('file://')) return false
  return downloadImageToFile(url, outPath)
}

async function searchPexelsPhoto(query, index, key) {
  const page = Math.floor(index / 12) + 1
  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&page=${page}&orientation=portrait`
  const res = await fetch(searchUrl, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS),
  })
  if (!res.ok) return null
  const data = await res.json()
  const photos = data.photos || []
  if (!photos.length) return null
  // Prefer photos whose alt text matches the query/topic
  const ranked = [...photos].sort((a, b) => {
    const sa = scoreImageRelevance(query, `${a.alt || ''} ${a.photographer || ''}`)
    const sb = scoreImageRelevance(query, `${b.alt || ''} ${b.photographer || ''}`)
    return sb - sa
  })
  const photo = ranked[0] || photos[index % photos.length]
  const imgUrl =
    photo?.src?.large2x || photo?.src?.large || photo?.src?.portrait || photo?.src?.medium || photo?.src?.original
  if (!imgUrl) return null
  return {
    imgUrl,
    photographer: photo.photographer || null,
    alt: photo.alt || '',
    pexelsId: photo.id,
    queryUsed: query,
    relevance: scoreImageRelevance(query, `${photo.alt || ''} ${photo.photographer || ''}`),
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

/** Coprime with common page sizes (10/12/15) so each rotation lands on a new candidate. */
const IMAGE_ROTATE_STRIDE = 7
/** Extra probe slots for AP/CSE/Pexels when avoid history is large (Oxylabs walks its full SERP pool). */
const IMAGE_ROTATE_MAX_TRIES = 8

/**
 * Fetch one scene image. On a rebuild, pass `attempt` (rotation count) and `avoidKeys`
 * (image keys already used for this scene) so we pull a DIFFERENT photo each time instead
 * of re-downloading the same top-ranked result. Returns `imageKey` so the caller can
 * record what was used and avoid it next time.
 * @param {{ imageQuery: string, topic?: string, caption?: string, outPath: string, index?: number, refresh?: boolean, attempt?: number, avoidKeys?: string[], wikiPool?: Array, oxyPool?: { hits?: Array, claimed?: Set<string>, query?: string, source?: string, plainTextDraft?: string, intent?: string } | null, plainTextDraft?: string, intent?: string, skipSlowFallbacks?: boolean }} opts
 */
export async function fetchEofSceneImage(opts) {
  try {
    return await withSceneDeadline(fetchEofSceneImageInner(opts), `Scene ${(opts?.index ?? 0) + 1} image`)
  } catch (e) {
    // Deadline / unexpected: write placeholder so the job can fail-fast with a clear all-placeholder error
    // instead of hanging the Production UI on a single scene.
    const outPath = opts?.outPath
    if (outPath) {
      console.warn(
        '[eof-scene-images] scene fetch aborted',
        e instanceof Error ? e.message : e,
        String(opts?.topic || '').slice(0, 40),
      )
      try {
        mkdirSync(dirname(outPath), { recursive: true })
        const fallbackQuery = String(opts?.imageQuery || opts?.topic || 'football')
        await writeLabeledPlaceholder({
          outPath,
          color: paletteForQuery(fallbackQuery, opts?.index || 0),
          label: fallbackQuery.split(/\s+/).slice(0, 3).join(' '),
        })
        return {
          path: outPath,
          source: 'placeholder',
          imageQuery: fallbackQuery,
        }
      } catch {
        /* fall through */
      }
    }
    throw e
  }
}

async function fetchEofSceneImageInner({
  imageQuery,
  topic,
  caption = '',
  outPath,
  index = 0,
  refresh = false,
  attempt = 0,
  avoidKeys = [],
  wikiPool = null,
  oxyPool = null,
  plainTextDraft = '',
  intent = null,
  skipSlowFallbacks = false,
}) {
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
  const pinterestToken = getEofPinterestAccessToken()
  const draft = String(plainTextDraft || oxyPool?.plainTextDraft || '').trim()
  const roleIntent = intent || oxyPool?.intent || undefined
  const anchoredQuery = anchorSceneImageQuery({
    topic,
    imageQuery,
    caption,
    sceneIndex: index,
    plainTextDraft: draft,
    intent: roleIntent,
  })
  const queries = buildSceneImageSearchQueries({
    topic,
    imageQuery: anchoredQuery,
    sceneIndex: index,
    plainTextDraft: draft,
    captions: caption,
    intent: roleIntent,
  })
  const custom = String(anchoredQuery || '').trim()
  // After Serp/Oxylabs job pool: skip unbounded AP/CSE/Pexels (common Cucurella hang).
  const slowOk = skipSlowFallbacks !== true

  const avoid = new Set((avoidKeys || []).filter(Boolean))
  const rot = Math.max(0, Number(attempt) || 0)
  // Only fan out across candidates when we're rotating (rebuild). First build stays a single fetch.
  const tries = rot > 0 || avoid.size ? IMAGE_ROTATE_MAX_TRIES : 1
  const effIndex = (t) => index + (rot + t) * IMAGE_ROTATE_STRIDE

  /**
   * Run a source across rotation tries, skipping images we've already used.
   * @param {(eff: number) => Promise<{ key: string, meta: object, download: () => Promise<boolean> } | null>} probe
   */
  async function rotateSource(probe) {
    let fallbackDup = null
    for (let t = 0; t < tries; t += 1) {
      let cand = null
      try {
        cand = await probe(effIndex(t))
      } catch (e) {
        console.warn('[eof-scene-images] source probe failed', e instanceof Error ? e.message : e)
        cand = null
      }
      if (!cand) continue
      if (avoid.has(cand.key)) {
        // Remember the first usable duplicate so we still ship an image if all fresh tries miss.
        if (!fallbackDup) fallbackDup = cand
        continue
      }
      if (await cand.download()) return { ...cand.meta, imageKey: cand.key }
    }
    if (fallbackDup && (await fallbackDup.download())) {
      return { ...fallbackDup.meta, imageKey: fallbackDup.key }
    }
    return null
  }

  if (custom && isPinterestPinUrl(custom)) {
    try {
      const hit = await fetchPinterestPinImage(custom)
      if (hit && (await downloadImageToFile(hit.imgUrl, outPath))) {
        return {
          path: outPath,
          source: 'pinterest-pin',
          imageQuery: hit.queryUsed,
          pinTitle: hit.title,
          imageKey: `pin-url:${custom}`,
        }
      }
    } catch (e) {
      console.warn('[eof-scene-images] Pinterest pin fetch failed', custom, e)
    }
  }

  // SerpAPI / Oxylabs job pool: consume shared hits only — NEVER fire a new query per scene.
  // Lead pool = 1 credit; optional secondary pool (+1) when the script names two people.
  if (oxyPool && Array.isArray(oxyPool.hits) && oxyPool.hits.length) {
    const poolSource = oxyPool.source === 'serpapi' ? 'serpapi' : 'oxylabs'
    const secondarySubject = String(oxyPool.secondarySubject || '').trim()
    const leadPoolSubject = String(oxyPool.subject || topic || '').trim()
    const poolQuery = String(oxyPool.query || '').trim()
    const qLower = String(anchoredQuery || '').toLowerCase()
    const useSecondary =
      secondarySubject &&
      Array.isArray(oxyPool.secondaryHits) &&
      oxyPool.secondaryHits.length &&
      qLower.includes(secondarySubject.split(/\s+/).filter(Boolean).pop()?.toLowerCase() || '___')
    const activeHits = useSecondary ? oxyPool.secondaryHits : oxyPool.hits
    const activeClaimed = useSecondary
      ? oxyPool.secondaryClaimed || (oxyPool.secondaryClaimed = new Set())
      : oxyPool.claimed || (oxyPool.claimed = new Set())
    const activeSubject = useSecondary ? secondarySubject : leadPoolSubject
    const activePoolQuery = useSecondary
      ? String(oxyPool.secondaryQuery || poolQuery).trim()
      : poolQuery
    const queryNamesSubject =
      Boolean(activePoolQuery) &&
      isNamedFootballSubject(activeSubject) &&
      hitMentionsSubject(activeSubject, activePoolQuery, '')
    const maxDownloadTries = 5
    for (let t = 0; t < maxDownloadTries; t += 1) {
      const claimed = claimOxylabsPoolHit({
        hits: activeHits,
        claimed: activeClaimed,
        avoidKeys: avoid,
        index: index + attempt + t,
        topic: activeSubject || topic,
        subject: activeSubject || topic,
        imageQuery: anchoredQuery,
        caption,
        plainTextDraft: draft,
        intent: useSecondary ? 'coach' : roleIntent,
        keyPrefix: useSecondary ? `${poolSource}-sec` : poolSource,
        jobQuery: activePoolQuery,
      })
      if (!claimed) break
      const titleBlank = !String(claimed.title || '').trim()
      const subjectCue =
        hitMentionsSubject(activeSubject, claimed.title || '', claimed.imgUrl || '') ||
        (queryNamesSubject && titleBlank)
      // Named subject: refuse stills that never mention them (titles lie less often than pixels, but still a gate).
      // Exception: empty-title Serp CDN URLs when the job query already named the person.
      if (
        isNamedFootballSubject(activeSubject) &&
        claimed.hitSource !== 'grok-imagine' &&
        claimed.hitSource !== 'free-gen' &&
        !subjectCue
      ) {
        console.info(
          '[eof-scene-images] reject claimed still — no subject cue',
          String(activeSubject).slice(0, 40),
          String(claimed.title || claimed.imgUrl || '').slice(0, 90),
        )
        activeClaimed.delete?.(claimed.key)
        continue
      }
      // Score the TITLE for the scene — job query alone must not rubber-stamp weak titles.
      // Prefer topic (full headline) over bare subject so job-query clubs/attrs don't tank scores.
      const score = scoreImageRelevance(
        topic || activeSubject || anchoredQuery || '',
        claimed.title || '',
        anchoredQuery || caption || '',
        { plainTextDraft: draft, captions: caption, intent: roleIntent },
      )
      const subjectNamed =
        isNamedFootballSubject(activeSubject) && subjectCue
      // Named-subject stills that already pass the name cue must not be discarded for a weak
      // token score (Cucurella: `"Marc Cucurella" Chelsea hair` used to score real titles at -2).
      if (
        score < 2 &&
        claimed.title &&
        !(Number(claimed.sceneScore) > 40) &&
        !subjectNamed
      ) {
        console.info(
          '[eof-scene-images] reject claimed still — weak title score',
          String(activeSubject || topic || '').slice(0, 40),
          `score=${score}`,
          String(claimed.title || '').slice(0, 90),
        )
        // Release so another scene can try a better-titled hit (vision-scored rows can keep weak titles).
        activeClaimed.delete?.(claimed.key)
        continue
      }
      const sceneSource =
        claimed.hitSource === 'grok-imagine' || claimed.hitSource === 'free-gen'
          ? claimed.hitSource
          : useSecondary
            ? `${poolSource}-secondary`
            : poolSource
      if (await materializeClaimedHit(claimed, outPath)) {
        return {
          path: outPath,
          source: sceneSource,
          imageQuery: anchoredQuery || oxyPool.query || imageQuery,
          imageTitle: claimed.title,
          imageUrl: claimed.imgUrl || null,
          relevance: score,
          imageKey: claimed.key,
          sceneScore: claimed.sceneScore,
        }
      }
      // Keep claimed on download failure — don't burn retries on a dead URL.
    }
    // Secondary pool empty/failed → fall back to lead pool once (still must match lead subject).
    if (useSecondary && Array.isArray(oxyPool.hits)) {
      const leadQueryNames =
        Boolean(poolQuery) &&
        isNamedFootballSubject(leadPoolSubject) &&
        hitMentionsSubject(leadPoolSubject, poolQuery, '')
      for (let t = 0; t < 3; t += 1) {
        const claimed = claimOxylabsPoolHit({
          hits: oxyPool.hits,
          claimed: oxyPool.claimed || (oxyPool.claimed = new Set()),
          avoidKeys: avoid,
          index: index + attempt + t,
          topic: leadPoolSubject || topic,
          subject: leadPoolSubject || topic,
          imageQuery: anchoredQuery,
          caption,
          plainTextDraft: draft,
          intent: roleIntent,
          keyPrefix: poolSource,
          jobQuery: poolQuery,
        })
        if (!claimed) break
        const titleBlank = !String(claimed.title || '').trim()
        const leadCue =
          hitMentionsSubject(leadPoolSubject, claimed.title || '', claimed.imgUrl || '') ||
          (leadQueryNames && titleBlank)
        if (
          isNamedFootballSubject(leadPoolSubject) &&
          claimed.hitSource !== 'grok-imagine' &&
          claimed.hitSource !== 'free-gen' &&
          !leadCue
        ) {
          oxyPool.claimed.delete?.(claimed.key)
          continue
        }
        if (await materializeClaimedHit(claimed, outPath)) {
          return {
            path: outPath,
            source:
              claimed.hitSource === 'grok-imagine' || claimed.hitSource === 'free-gen'
                ? claimed.hitSource
                : poolSource,
            imageQuery: anchoredQuery || oxyPool.query || imageQuery,
            imageTitle: claimed.title,
            imageUrl: claimed.imgUrl || null,
            imageKey: claimed.key,
            sceneScore: claimed.sceneScore,
          }
        }
      }
    }
  }

  // Search order after Google Images pool: AP → CSE → Pexels → Pinterest → Wikimedia last.
  // Do NOT short-circuit named people through Wikidata portraits — that was forcing old Commons stills.
  // When a Serp/Oxylabs job pool already ran, skip these — hung CSE/Pexels sockets were freezing Rebuild.
  if (slowOk) {
    for (const query of queries) {
      if (isPinterestPinUrl(query)) continue

      // AP editorial — licensed breaking-news stills when keyed
      if (isEofApImagesConfigured()) {
        const meta = await rotateSource(async (eff) => {
          const hit = await searchApMediaPicture(query, eff, { topic })
          if (!hit) return null
          const score =
            typeof hit.relevance === 'number'
              ? hit.relevance
              : scoreImageRelevance(topic || query, hit.title || '', query)
          if (score < 4) return null // require a real topic/entity hit — never accept random AP stock
          return {
            key: `ap:${hit.apItemId || hit.title || hit.imgUrl || eff}`,
            meta: {
              path: outPath,
              source: 'ap',
              imageQuery: query,
              imageTitle: hit.title,
              imageUrl: hit.imgUrl || null,
              apItemId: hit.apItemId,
              apRole: hit.role,
              relevance: score,
            },
            download: () => downloadApRenditionToFile(hit, outPath),
          }
        })
        if (meta) return meta
      }

      if (isEofGoogleCseConfigured()) {
        const meta = await rotateSource(async (eff) => {
          const hit = await searchGoogleCseImages(query, eff)
          if (!hit) return null
          const score = scoreImageRelevance(topic || query, `${hit.title || ''} ${hit.sourcePage || ''}`, query)
          if (score < 6) return null
          return {
            key: `google:${hit.imgUrl}`,
            meta: {
              path: outPath,
              source: 'google',
              imageQuery: query,
              imageTitle: hit.title,
              imageUrl: hit.imgUrl || null,
              sourcePage: hit.sourcePage,
              relevance: score,
            },
            download: () => downloadImageToFile(hit.imgUrl, outPath),
          }
        })
        if (meta) return meta
      }

      if (pexelsKey) {
        const meta = await rotateSource(async (eff) => {
          const hit = await searchPexelsPhoto(query, eff, pexelsKey)
          if (!hit) return null
          const score =
            typeof hit.relevance === 'number'
              ? hit.relevance
              : scoreImageRelevance(topic || query, hit.alt || '', query)
          if (score < 6) return null
          return {
            key: `pexels:${hit.pexelsId}`,
            meta: {
              path: outPath,
              source: 'pexels',
              imageQuery: query,
              photographer: hit.photographer,
              pexelsId: hit.pexelsId,
              relevance: score,
            },
            download: () => downloadImageToFile(hit.imgUrl, outPath),
          }
        })
        if (meta) return meta
      }

      // Pinterest — only if token present (often unauthorized for catalog search)
      if (pinterestToken) {
        const meta = await rotateSource(async (eff) => {
          const hit = await searchPinterestPartnerPins(query, eff, pinterestToken, { topic })
          if (!hit || (hit.relevance ?? 0) < 6) return null
          return {
            key: `pin:${hit.pinId || hit.imgUrl}`,
            meta: {
              path: outPath,
              source: 'pinterest',
              imageQuery: query,
              pinId: hit.pinId,
              pinTitle: hit.title,
              imageUrl: hit.imgUrl || null,
              relevance: hit.relevance,
            },
            download: () => downloadImageToFile(hit.imgUrl, outPath),
          }
        })
        if (meta) return meta
      }
    }
  }

  // Last resort only: Wikidata/Commons (pre-built pool when available)
  {
    // A scene's own caption sometimes names a secondary person (e.g. "Ferguson") distinct
    // from the job's lead subject — the pre-built wikiPool/blanket draft-expansion only ever
    // resolves the lead subject, so that secondary person's photo never got sourced even in
    // this last-resort fallback. Prefer a caption-named secondary subject for this scene only.
    const secondarySubjects = listSecondaryImageSubjects(topic, draft)
    const captionSecondary = secondarySubjects.find((s) => personMentionedInText(s, caption))
    const subject = captionSecondary || resolveImageSubject(topic || custom, draft)
    // The pre-built wikiPool is single-subject (lead only) — do not reuse it for a
    // different, secondary-subject scene, or it would hand back the wrong person's photo.
    const usablePool = captionSecondary ? undefined : wikiPool
    let fallbackDup = null
    for (let t = 0; t < tries; t += 1) {
      let cand = null
      try {
        const hit = await searchWikimediaCommonsImages(subject || queries[0] || topic || 'football', index, {
          topic: topic || subject,
          rotate: rot + t,
          pool: Array.isArray(usablePool) && usablePool.length ? usablePool : undefined,
          plainTextDraft: draft,
        })
        if (hit && (hit.relevance ?? 0) >= 6) {
          cand = {
            key: `wiki:${hit.title || hit.imgUrl}`,
            meta: {
              path: outPath,
              source: 'wikimedia',
              imageQuery: hit.queryUsed || subject || queries[0],
              imageTitle: hit.title,
              imageUrl: hit.imgUrl || null,
              relevance: hit.relevance,
              imageYear: hit.year || null,
              wikiDetail: hit.sourceDetail || null,
            },
            download: () => downloadImageToFile(hit.imgUrl, outPath),
          }
        }
      } catch (e) {
        console.warn('[eof-scene-images] wikimedia fallback failed', e instanceof Error ? e.message : e)
      }
      if (!cand) continue
      if (avoid.has(cand.key)) {
        if (!fallbackDup) fallbackDup = cand
        continue
      }
      if (await cand.download()) return { ...cand.meta, imageKey: cand.key }
    }
    if (fallbackDup && (await fallbackDup.download())) {
      return { ...fallbackDup.meta, imageKey: fallbackDup.key }
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

  const hasAnyKey =
    isEofApImagesConfigured() ||
    isEofSerpApiConfigured() ||
    isEofOxylabsConfigured() ||
    pexelsKey ||
    pinterestToken ||
    isEofGoogleCseConfigured()
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
