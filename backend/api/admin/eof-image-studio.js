import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import {
  fetchEofGrokImagineBuffer,
  isEofGrokImagineConfigured,
  EOF_IMAGE_STUDIO_ASPECT_RATIOS,
  normalizeEofImageStudioAspectRatio,
} from '../lib/eofGrokImagineImages.mjs'
import {
  buildEofImageStudioPrompt,
  describeEofReferenceImages,
  MAX_DOCUMENT_TEXT_CHARS,
  MAX_REFERENCE_IMAGES,
  parseEofReferenceImageDataUrls,
  truncateEofDocumentText,
} from '../lib/eofImageStudioReference.mjs'
import {
  addEofImageStudioHistoryEntry,
  listEofImageStudioHistory,
  deleteEofImageStudioHistoryEntry,
  clearEofImageStudioHistory,
} from '../lib/eofImageStudioHistoryStore.mjs'

function firstQueryString(val) {
  if (Array.isArray(val)) return typeof val[0] === 'string' ? val[0] : ''
  return typeof val === 'string' ? val : ''
}

/** Express strips the path from `req.url` after routing; `originalUrl` keeps `?query`. */
function searchParamsFromReq(req) {
  const pathAndQuery = req.originalUrl || req.url || '/'
  try {
    return new URL(pathAndQuery, 'http://local').searchParams
  } catch {
    return new URLSearchParams()
  }
}

/**
 * Ad-hoc xAI (Grok Imagine) image generation — a free-form "chat prompt" tool for thumbnails
 * or any other one-off image work, decoupled from any production job/scene pipeline.
 *
 * GET    — configuration status + supported aspect ratios + this user's saved history.
 * POST { prompt, aspectRatio?, referenceImages?, documentText? } — generate one image, returned
 *       inline as base64 (no disk persistence; Vercel's /tmp is ephemeral per-instance, so bytes
 *       are handed back directly instead) and saved to this user's persistent history.
 *       `referenceImages` is an array of up to `MAX_REFERENCE_IMAGES` `data:image/...;base64,...`
 *       strings (a legacy singular `referenceImage` string is still accepted) — xAI's generation
 *       endpoint has no image-to-image input, so they're described together via a Grok vision call
 *       and folded into the prompt (style/subject guidance only, not a pixel-accurate edit).
 *       `documentText` is plain text (e.g. pasted/`.txt`/`.md` content) folded in as extra context.
 * DELETE ?id=<id>   — delete one history entry (scoped to this user).
 * DELETE ?all=1     — clear this user's entire history.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Eyes Of Football production is only available on staging.' })
  }

  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  let payload
  try {
    payload = await requireEofSession(req)
  } catch (e) {
    return json(res, e.statusCode || 401, { error: 'Unauthorized' })
  }
  const username = eofSessionInfo(payload).username || 'unknown'

  if (req.method === 'GET') {
    let history = []
    try {
      history = await listEofImageStudioHistory(username)
    } catch (e) {
      console.error('[eof-image-studio] history load failed:', e)
    }
    return json(res, 200, {
      ok: true,
      configured: isEofGrokImagineConfigured(),
      aspectRatios: EOF_IMAGE_STUDIO_ASPECT_RATIOS,
      costNote: '~$0.05 per image (xAI Grok Imagine quality model)',
      maxDocumentTextChars: MAX_DOCUMENT_TEXT_CHARS,
      maxReferenceImages: MAX_REFERENCE_IMAGES,
      history,
    })
  }

  if (req.method === 'DELETE') {
    const sp = searchParamsFromReq(req)
    const clearAll = firstQueryString(req.query?.all) === '1' || sp.get('all') === '1'
    try {
      if (clearAll) {
        const deleted = await clearEofImageStudioHistory(username)
        return json(res, 200, { ok: true, deleted })
      }
      const id = (firstQueryString(req.query?.id) || sp.get('id') || '').trim()
      if (!id) return json(res, 400, { error: 'id is required' })
      const deleted = await deleteEofImageStudioHistoryEntry(username, id)
      if (!deleted) return json(res, 404, { error: 'Not found' })
      return json(res, 200, { ok: true })
    } catch (e) {
      console.error('[eof-image-studio] history delete failed:', e)
      return json(res, 500, { error: e instanceof Error ? e.message : 'Delete failed' })
    }
  }

  const body = await readJsonBody(req)
  const prompt = String(body.prompt || '').trim()
  if (!prompt) return json(res, 400, { error: 'Prompt is required.' })
  if (prompt.length > 2000) return json(res, 400, { error: 'Prompt is too long (max 2000 characters).' })
  if (!isEofGrokImagineConfigured()) {
    return json(res, 400, { error: 'XAI_API_KEY is not configured on the server.' })
  }

  const aspectRatio = normalizeEofImageStudioAspectRatio(body.aspectRatio)
  const documentExcerpt = truncateEofDocumentText(body.documentText)

  const referenceImagesInput = Array.isArray(body.referenceImages)
    ? body.referenceImages
    : typeof body.referenceImage === 'string' && body.referenceImage.trim()
      ? [body.referenceImage]
      : []

  let referenceDescription = ''
  let referenceImageUsed = false
  let referenceImageCount = 0
  let referenceImageWarning = ''
  if (referenceImagesInput.length) {
    try {
      const parsed = parseEofReferenceImageDataUrls(referenceImagesInput)
      if (parsed.length) {
        referenceDescription = await describeEofReferenceImages({ dataUrls: parsed.map((p) => p.dataUrl) })
        referenceImageUsed = true
        referenceImageCount = parsed.length
      }
    } catch (e) {
      // Non-fatal — fall back to generating from the text prompt (+ document) alone.
      referenceImageWarning = e instanceof Error ? e.message : 'Could not use the reference image(s).'
      console.warn('[eof-image-studio] reference image(s) skipped:', referenceImageWarning)
    }
  }

  const finalPrompt = buildEofImageStudioPrompt({ prompt, documentExcerpt, referenceDescription })

  try {
    const { buffer, mime, promptUsed } = await fetchEofGrokImagineBuffer({ prompt: finalPrompt, aspectRatio })
    const imageBase64 = buffer.toString('base64')
    const createdAt = new Date().toISOString()

    let historyId = null
    try {
      const saved = await addEofImageStudioHistoryEntry({
        username,
        prompt: promptUsed,
        userPrompt: prompt,
        aspectRatio,
        mime,
        bytes: buffer.length,
        imageBase64,
        referenceImageUsed,
        referenceImageCount,
        referenceDescription: referenceImageUsed ? referenceDescription : '',
        referenceImageWarning,
        documentExcerptUsed: Boolean(documentExcerpt),
      })
      historyId = saved?.id || null
    } catch (e) {
      // Non-fatal — the generated image is still returned to the user even if persistence fails.
      console.error('[eof-image-studio] history save failed:', e)
    }

    return json(res, 200, {
      ok: true,
      id: historyId,
      mime,
      bytes: buffer.length,
      imageBase64,
      prompt: promptUsed,
      userPrompt: prompt,
      aspectRatio,
      referenceImageUsed,
      referenceImageCount,
      referenceDescription: referenceImageUsed ? referenceDescription : '',
      referenceImageWarning,
      documentExcerptUsed: Boolean(documentExcerpt),
      createdAt,
    })
  } catch (e) {
    console.error('[eof-image-studio]', e)
    return json(res, 400, { error: e instanceof Error ? e.message : 'Image generation failed' })
  }
}
