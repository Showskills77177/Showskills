/**
 * xAI Grok helpers for EOF production (scripts, news topics, Studio meta).
 * Prefers Grok 4.5 via Responses API, with Chat Completions fallback.
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

/** Preferred model order — Grok 4.5 first. */
export function xaiModelCandidates() {
  const configured = envKey('XAI_MODEL', 'EOF_XAI_MODEL')
  return [configured || 'grok-4.5', 'grok-4.5-latest', 'grok-4', 'grok-3-latest', 'grok-2-latest'].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  )
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

/**
 * Call Grok and return raw text (not JSON).
 * @param {{ system: string, user: string, temperature?: number }} opts
 */
export async function xaiTextCompletion({ system, user, temperature = 0.4 }) {
  const key = getXaiApiKey()
  if (!key) throw new Error('XAI_API_KEY is not set')

  const models = xaiModelCandidates()
  let lastError = null

  for (const model of models) {
    try {
      const res = await fetch('https://api.x.ai/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature,
          input: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = extractResponsesText(data)
        if (!text?.trim()) throw new Error('empty Grok response')
        return text.trim()
      }

      if (res.status === 404 || res.status === 400 || res.status === 422) {
        const chat = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        })
        if (!chat.ok) {
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
      console.warn('[eof-xai] text model failed', model, e instanceof Error ? e.message : e)
    }
  }

  throw lastError || new Error('xAI Grok text request failed')
}

/**
 * Call Grok and return parsed JSON.
 * @param {{ system: string, user: string, temperature?: number }} opts
 */
export async function xaiJsonCompletion({ system, user, temperature = 0.45 }) {
  const key = getXaiApiKey()
  if (!key) throw new Error('XAI_API_KEY is not set')

  const models = xaiModelCandidates()
  let lastError = null

  for (const model of models) {
    try {
      // Prefer Responses API (Grok 4.5)
      const res = await fetch('https://api.x.ai/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature,
          input: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = extractResponsesText(data)
        if (!text) throw new Error('empty Grok response')
        return parseJsonContent(text)
      }

      // Fallback: Chat Completions (older models / accounts)
      if (res.status === 404 || res.status === 400 || res.status === 422) {
        const chat = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        })
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
      console.warn('[eof-xai] model failed', model, e instanceof Error ? e.message : e)
    }
  }

  throw lastError || new Error('xAI Grok request failed')
}
