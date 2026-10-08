import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession } from '../lib/eofYoutubeAuth.mjs'
import {
  fetchEofGrokImagineBuffer,
  isEofGrokImagineConfigured,
  EOF_IMAGE_STUDIO_ASPECT_RATIOS,
  normalizeEofImageStudioAspectRatio,
} from '../lib/eofGrokImagineImages.mjs'
import {
  buildEofImageStudioPrompt,
  describeEofReferenceImage,
  MAX_DOCUMENT_TEXT_CHARS,
  parseEofReferenceImageDataUrl,
  truncateEofDocumentText,
} from '../lib/eofImageStudioReference.mjs'

/**
 * Ad-hoc xAI (Grok Imagine) image generation — a free-form "chat prompt" tool for thumbnails
 * or any other one-off image work, decoupled from any production job/scene pipeline.
 *
 * GET  — configuration status + supported aspect ratios.
 * POST { prompt, aspectRatio?, referenceImage?, documentText? } — generate one image, returned
 *       inline as base64 (no disk persistence; Vercel's /tmp is ephemeral per-instance, so bytes
 *       are handed back directly instead).
 *       `referenceImage` is a `data:image/...;base64,...` string — xAI's generation endpoint has
 *       no image-to-image input, so it's described via a Grok vision call and folded into the
 *       prompt (style/subject guidance only, not a pixel-accurate edit).
 *       `documentText` is plain text (e.g. pasted/`.txt`/`.md` content) folded in as extra context.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Eyes Of Football production is only available on staging.' })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    await requireEofSession(req)
  } catch (e) {
    return json(res, e.statusCode || 401, { error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      configured: isEofGrokImagineConfigured(),
      aspectRatios: EOF_IMAGE_STUDIO_ASPECT_RATIOS,
      costNote: '~$0.05 per image (xAI Grok Imagine quality model)',
      maxDocumentTextChars: MAX_DOCUMENT_TEXT_CHARS,
    })
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

  let referenceDescription = ''
  let referenceImageUsed = false
  let referenceImageWarning = ''
  const referenceImageInput = typeof body.referenceImage === 'string' ? body.referenceImage.trim() : ''
  if (referenceImageInput) {
    try {
      const { dataUrl } = parseEofReferenceImageDataUrl(referenceImageInput)
      referenceDescription = await describeEofReferenceImage({ dataUrl })
      referenceImageUsed = true
    } catch (e) {
      // Non-fatal — fall back to generating from the text prompt (+ document) alone.
      referenceImageWarning = e instanceof Error ? e.message : 'Could not use the reference image.'
      console.warn('[eof-image-studio] reference image skipped:', referenceImageWarning)
    }
  }

  const finalPrompt = buildEofImageStudioPrompt({ prompt, documentExcerpt, referenceDescription })

  try {
    const { buffer, mime, promptUsed } = await fetchEofGrokImagineBuffer({ prompt: finalPrompt, aspectRatio })
    return json(res, 200, {
      ok: true,
      mime,
      bytes: buffer.length,
      imageBase64: buffer.toString('base64'),
      prompt: promptUsed,
      userPrompt: prompt,
      aspectRatio,
      referenceImageUsed,
      referenceDescription: referenceImageUsed ? referenceDescription : '',
      referenceImageWarning,
      documentExcerptUsed: Boolean(documentExcerpt),
      createdAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[eof-image-studio]', e)
    return json(res, 400, { error: e instanceof Error ? e.message : 'Image generation failed' })
  }
}
