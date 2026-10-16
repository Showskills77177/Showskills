import { eofJsonCompletion } from './eofScriptWriter.mjs'
import { EOF_KREA_VIDEO_MAX_PROMPT_LENGTH, EOF_KREA_VIDEO_MODELS } from './eofKreaVideo.mjs'

const MODEL_GUIDE = Object.entries(EOF_KREA_VIDEO_MODELS)
  .map(
    ([id, model]) =>
      `${id}: ${model.label}; per-clip duration ${model.minDuration}-${model.maxDuration} seconds; ${model.supportsReferences ? 'supports video references' : 'no video references'}.`,
  )
  .join('\n')

const SYSTEM_PROMPT = `You choose a Krea video model and extract the requested clip duration.
Return JSON only with exactly these fields:
{"modelId":"seedance-fast|seedance-mini|wan-3","durationSeconds":10,"reason":"brief explanation"}

Available Krea models:
${MODEL_GUIDE}

Rules:
- Read the user's requested duration from their prompt. Accept seconds, minutes, and combined forms such as "1 minute 20 seconds".
- If no duration is requested, use 10 seconds.
- A single Krea job cannot exceed the selected model's documented maximum. Choose a model that supports the requested duration.
- If a requested duration exceeds 30 seconds, still choose wan-3 and return the requested duration; the server will explain Krea's per-job limitation.
- Prefer seedance-fast for simple short requests, seedance-mini for requests needing more capable motion at up to 15 seconds, and wan-3 for longer, complex, or native-audio requests.
- Do not rewrite, summarize, or add anything to the user's prompt. This response is used only to select a model and duration.`

export async function selectEofKreaVideoModel({ prompt, aspectRatio, resolution } = {}) {
  const exactPrompt = typeof prompt === 'string' ? prompt : ''
  if (!exactPrompt.trim()) {
    const error = new Error('Enter a video prompt.')
    error.statusCode = 400
    error.code = 'INVALID_PROMPT'
    throw error
  }
  if (exactPrompt.length > EOF_KREA_VIDEO_MAX_PROMPT_LENGTH) {
    const error = new Error(`Prompt must be ${EOF_KREA_VIDEO_MAX_PROMPT_LENGTH} characters or fewer.`)
    error.statusCode = 400
    error.code = 'PROMPT_TOO_LONG'
    throw error
  }

  let selection
  try {
    selection = await eofJsonCompletion({
      system: SYSTEM_PROMPT,
      user: JSON.stringify({ prompt: exactPrompt, aspectRatio, resolution }),
      temperature: 0,
      timeoutMs: 30_000,
    })
  } catch (cause) {
    const notConfigured =
      cause instanceof Error && /not configured/i.test(cause.message)
    const error = new Error(
      notConfigured
        ? cause.message
        : 'The EOF Script AI could not choose a Krea model. Check its Vercel staging credentials and retry.',
    )
    error.statusCode = notConfigured ? 503 : 502
    error.code = notConfigured ? 'MODEL_SELECTOR_NOT_CONFIGURED' : 'MODEL_SELECTION_FAILED'
    throw error
  }

  const modelId = typeof selection?.modelId === 'string' ? selection.modelId : ''
  const durationSeconds = Number(selection?.durationSeconds)
  const model = EOF_KREA_VIDEO_MODELS[modelId]
  if (!model || !Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 86400) {
    const error = new Error('The AI returned an invalid model or duration. Please clarify the requested clip length and retry.')
    error.statusCode = 502
    error.code = 'INVALID_MODEL_SELECTION'
    throw error
  }

  return {
    modelId,
    modelLabel: model.label,
    durationSeconds,
    maxClipDurationSeconds: model.maxDuration,
    reason: typeof selection.reason === 'string' ? selection.reason.trim().slice(0, 240) : '',
  }
}
