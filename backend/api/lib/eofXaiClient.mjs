/**
 * xAI Grok helpers for EOF production (scripts, news topics, Studio meta).
 * Prefers Grok 4.5 via Responses API, with Chat Completions fallback.
 *
 * Important: grok-4.5 defaults to reasoning_effort "high" (very slow).
 * EOF Shorts use "low" so Create / Generate script stay interactive.
 */
function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function getXaiApiKey() {
  return envKey('XAI_API_KEY', 'EOF_XAI_API_KEY')
}

export function isXaiConfigured() {
  return Boolean(getXaiApiKey())
}

/** Preferred model order — Grok 4.5 first, then older chat-capable models. */
export function xaiModelCandidates() {
  const configured = envKey('XAI_MODEL', 'EOF_XAI_MODEL')
  return [configured || 'grok-4.5', 'grok-4.5-latest', 'grok-4', 'grok-3-latest', 'grok-2-latest'].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  )
}

function resolveReasoningEffort(effort) {
  const v = String(effort || envKey('XAI_REASONING_EFFORT', 'EOF_XAI_REASONING_EFFORT') || 'low')
    .trim()
    .toLowerCase()
  if (v === 'medium' || v === 'high') return v
  return 'low'
}

function requestTimeoutMs() {
  const n = Number(envKey('XAI_TIMEOUT_MS', 'EOF_XAI_TIMEOUT_MS') || 55000)
  return Number.isFinite(n) && n >= 8000 ? Math.min(n, 120000) : 55000
}

function parseJsonContent(content) {
  const raw = String(content || '').trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(raw)
  const body = fenced ? fenced[1].trim() : raw
  return JSON.parse(body)
}

function extractResponsesText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text
  const parts = []
  for (const item of data?.output || []) {
    if (item?.type === 'message') {
      for (const c of item.content || []) {
        if (c?.type === 'output_text' && c.text) parts.push(c.text)
        if (c?.type === 'text' && c.text) parts.push(c.text)
      }
    }
  }
  if (parts.length) return parts.join('\n')
  const choice = data?.choices?.[0]?.message?.content
  return typeof choice === 'string' ? choice : ''
}

function isFatalXaiStatus(status) {
  return status === 401 || status === 403 || status === 402
}

function modelNeedsReasoning(model) {
  return /grok-4\.5|grok-4-5|grok-build/i.test(String(model || ''))
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

/**
 * Call Grok and return raw text (not JSON).
 * @param {{ system: string, user: string, temperature?: number, reasoningEffort?: string }} opts
 */
export async function xaiTextCompletion({ system, user, temperature = 0.4, reasoningEffort } = {}) {
  const key = getXaiApiKey()
  if (!key) throw new Error('XAI_API_KEY is not set')

  const models = xaiModelCandidates()
  const effort = resolveReasoningEffort(reasoningEffort)
  const timeoutMs = requestTimeoutMs()
  let lastError = null

  for (const model of models) {
    try {
      const responsesBody = {
        model,
        temperature,
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }
      if (modelNeedsReasoning(model)) {
        responsesBody.reasoning = { effort }
      }

      const res = await fetchWithTimeout(
        'https://api.x.ai/v1/responses',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(responsesBody),
        },
        timeoutMs,
      )

      if (res.ok) {
        const data = await res.json()
        const text = extractResponsesText(data)
        if (!text?.trim()) throw new Error('empty Grok response')
        return text.trim()
      }

      if (isFatalXaiStatus(res.status)) {
        const errText = await res.text().catch(() => '')
        throw new Error(`xAI ${res.status}: ${errText.slice(0, 240)}`)
      }

      if (res.status === 404 || res.status === 400 || res.status === 422) {
        const chatBody = {
          model,
          temperature,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }
        if (modelNeedsReasoning(model)) {
          chatBody.reasoning_effort = effort
        }

        const chat = await fetchWithTimeout(
          'https://api.x.ai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatBody),
          },
          timeoutMs,
        )
        if (!chat.ok) {
          if (isFatalXaiStatus(chat.status)) {
            const errText = await chat.text().catch(() => '')
            throw new Error(`xAI ${chat.status}: ${errText.slice(0, 240)}`)
          }
          const errText = await chat.text().catch(() => '')
          throw new Error(`xAI ${chat.status}: ${errText.slice(0, 240)}`)
        }
        const data = await chat.json()
        const content = data?.choices?.[0]?.message?.content
        if (!content?.trim()) throw new Error('empty Grok chat content')
        return String(content).trim()
      }

      const errText = await res.text().catch(() => '')
      throw new Error(`xAI ${res.status}: ${errText.slice(0, 240)}`)
    } catch (e) {
      lastError = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[eof-xai] text model failed', model, msg)
      if (/xAI (401|402|403):/.test(msg)) break
    }
  }

  throw lastError || new Error('xAI Grok text request failed')
}

/**
 * Call Grok and return parsed JSON.
 * @param {{ system: string, user: string, temperature?: number, reasoningEffort?: string }} opts
 */
export async function xaiJsonCompletion({ system, user, temperature = 0.45, reasoningEffort } = {}) {
  const key = getXaiApiKey()
  if (!key) throw new Error('XAI_API_KEY is not set')

  const models = xaiModelCandidates()
  const effort = resolveReasoningEffort(reasoningEffort)
  const timeoutMs = requestTimeoutMs()
  let lastError = null

  for (const model of models) {
    try {
      const responsesBody = {
        model,
        temperature,
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }
      if (modelNeedsReasoning(model)) {
        responsesBody.reasoning = { effort }
      }

      const res = await fetchWithTimeout(
        'https://api.x.ai/v1/responses',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(responsesBody),
        },
        timeoutMs,
      )

      if (res.ok) {
        const data = await res.json()
        const text = extractResponsesText(data)
        if (!text) throw new Error('empty Grok response')
        return parseJsonContent(text)
      }

      if (isFatalXaiStatus(res.status)) {
        const errText = await res.text().catch(() => '')
        throw new Error(`xAI ${res.status}: ${errText.slice(0, 240)}`)
      }

      if (res.status === 404 || res.status === 400 || res.status === 422) {
        const chatBody = {
          model,
          temperature,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }
        if (modelNeedsReasoning(model)) {
          chatBody.reasoning_effort = effort
        }

        const chat = await fetchWithTimeout(
          'https://api.x.ai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatBody),
          },
          timeoutMs,
        )
        if (!chat.ok) {
          const errText = await chat.text().catch(() => '')
          throw new Error(`xAI ${chat.status}: ${errText.slice(0, 240)}`)
        }
        const data = await chat.json()
        const content = data?.choices?.[0]?.message?.content
        if (!content) throw new Error('empty Grok chat content')
        return parseJsonContent(content)
      }

      const errText = await res.text().catch(() => '')
      throw new Error(`xAI ${res.status}: ${errText.slice(0, 240)}`)
    } catch (e) {
      lastError = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[eof-xai] model failed', model, msg)
      if (/xAI (401|402|403):/.test(msg)) break
    }
  }

  throw lastError || new Error('xAI Grok request failed')
}
