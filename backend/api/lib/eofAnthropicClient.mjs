/**
 * Anthropic Claude helpers for EOF script writing (Messages API).
 *
 * Env:
 *   ANTHROPIC_API_KEY / EOF_ANTHROPIC_API_KEY
 *   ANTHROPIC_MODEL / EOF_ANTHROPIC_MODEL / CLAUDE_MODEL  (default claude-sonnet-4-6)
 */
function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function getAnthropicApiKey() {
  return envKey('ANTHROPIC_API_KEY', 'EOF_ANTHROPIC_API_KEY')
}

export function isAnthropicConfigured() {
  return Boolean(getAnthropicApiKey())
}

/** Preferred model order — Sonnet 4.6 first, then adjacent aliases. */
export function anthropicModelCandidates() {
  const configured = envKey('ANTHROPIC_MODEL', 'EOF_ANTHROPIC_MODEL', 'CLAUDE_MODEL')
  const defaults = ['claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-sonnet-5']
  if (!configured) return defaults
  return [configured, ...defaults.filter((m) => m !== configured)]
}

function requestTimeoutMs() {
  const n = Number(envKey('ANTHROPIC_TIMEOUT_MS', 'EOF_ANTHROPIC_TIMEOUT_MS') || 55000)
  return Number.isFinite(n) && n >= 8000 ? Math.min(n, 120000) : 55000
}

function parseJsonContent(content) {
  const raw = String(content || '').trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(raw)
  const body = fenced ? fenced[1].trim() : raw
  return JSON.parse(body)
}

function extractText(data) {
  const parts = []
  for (const block of data?.content || []) {
    if (block?.type === 'text' && block.text) parts.push(block.text)
  }
  if (parts.length) return parts.join('\n')
  return typeof data?.content === 'string' ? data.content : ''
}

function isRetryableModelError(status, errText) {
  if (status === 404) return true
  return /model.?not.?found|invalid.?model|does not exist|not.?currently.?supported|deprecated/i.test(
    String(errText || ''),
  )
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function anthropicMessages({ system, user, temperature = 0.4, maxTokens = 1024 } = {}) {
  const key = getAnthropicApiKey()
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')

  const models = anthropicModelCandidates()
  const timeoutMs = requestTimeoutMs()
  let lastError = null

  for (const model of models) {
    try {
      const res = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            system,
            messages: [{ role: 'user', content: user }],
          }),
        },
        timeoutMs,
      )
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        lastError = new Error(`Anthropic ${res.status}: ${errText.slice(0, 240)}`)
        if (res.status === 401 || res.status === 403) throw lastError
        if (isRetryableModelError(res.status, errText)) {
          console.warn('[eof-anthropic] model failed, trying next', model, lastError.message)
          continue
        }
        throw lastError
      }
      const data = await res.json()
      const text = extractText(data)
      if (!String(text || '').trim()) throw new Error('Anthropic returned empty content')
      return String(text).trim()
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (/401|403|ANTHROPIC_API_KEY/.test(lastError.message)) throw lastError
      console.warn('[eof-anthropic] request failed', model, lastError.message)
    }
  }
  throw lastError || new Error('Anthropic completion failed')
}

/**
 * @param {{ system: string, user: string, temperature?: number }} opts
 */
export async function anthropicTextCompletion({ system, user, temperature = 0.4 } = {}) {
  return anthropicMessages({ system, user, temperature, maxTokens: 900 })
}

/**
 * Prompt for JSON and parse — Anthropic has no response_format flag like OpenAI.
 * @param {{ system: string, user: string, temperature?: number }} opts
 */
export async function anthropicJsonCompletion({ system, user, temperature = 0.25 } = {}) {
  const text = await anthropicMessages({
    system: `${system}\n\nReturn ONLY one valid JSON object. No markdown fences or commentary.`,
    user,
    temperature,
    maxTokens: 1400,
  })
  return parseJsonContent(text)
}
