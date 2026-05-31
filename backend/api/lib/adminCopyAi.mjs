const DEFAULT_MODEL = 'gpt-4o-mini'

const FIELD_GUIDANCE = {
  competition_summary:
    'Write a short public-facing summary (1–2 sentences, max 220 characters) for a UK skill-based prize draw on ShowSkills Rewards. Exciting, clear, compliant — no guaranteed-win language, no false urgency.',
  competition_rules:
    'Write competition rules in Markdown for a UK skill-based prize draw on ShowSkills. Cover: who can enter (18+, UK), how to enter, quiz/skill requirement, draw timing, prize description, and standard promoter disclaimers. Use headings and bullet lists. Professional and readable.',
  bundle_checkout_line:
    'Write one short checkout line (max 60 characters) shown beside a ticket bundle at purchase. Mention ticket count and value clearly.',
}

function getOpenAiKey() {
  return (process.env.OPENAI_API_KEY || '').trim()
}

function getOpenAiModel() {
  return (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
}

export function isAdminCopyAiConfigured() {
  return Boolean(getOpenAiKey())
}

function buildUserPrompt(field, instructions, context = {}) {
  const parts = [FIELD_GUIDANCE[field] || 'Write concise marketing copy for ShowSkills.']

  if (context.competitionTitle) parts.push(`Competition title: ${context.competitionTitle}`)
  if (context.bundleTitle) parts.push(`Bundle name: ${context.bundleTitle}`)
  if (context.bundleQty) parts.push(`Tickets in bundle: ${context.bundleQty}`)
  if (context.bundlePriceGbp) parts.push(`Bundle price: £${context.bundlePriceGbp}`)
  if (context.existingText?.trim()) {
    parts.push(`Current draft (improve or replace as appropriate):\n${context.existingText.trim()}`)
  }
  if (instructions?.trim()) {
    parts.push(`Staff instructions:\n${instructions.trim()}`)
  }

  parts.push('Return only the finished copy — no quotes, labels, or explanation.')
  return parts.join('\n\n')
}

/**
 * @param {{ field: string, instructions?: string, context?: Record<string, unknown> }} input
 */
export async function generateAdminCopy(input) {
  const apiKey = getOpenAiKey()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set on the server. Add it in Vercel → Production env, then redeploy.')
  }

  const field = typeof input.field === 'string' ? input.field.trim() : ''
  if (!FIELD_GUIDANCE[field]) {
    throw new Error('Unsupported copy field.')
  }

  const instructions = typeof input.instructions === 'string' ? input.instructions : ''
  const context = input.context && typeof input.context === 'object' ? input.context : {}

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      temperature: 0.7,
      max_tokens: field === 'competition_rules' ? 1200 : 180,
      messages: [
        {
          role: 'system',
          content:
            'You write copy for ShowSkills Rewards, a UK skill-based prize competition website. Follow UK promotional compliance: skill quiz before entry counts as a qualifying step, avoid misleading claims, keep tone premium and football/collectibles-friendly when relevant.',
        },
        {
          role: 'user',
          content: buildUserPrompt(field, instructions, context),
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      `OpenAI request failed (HTTP ${res.status})`
    throw new Error(msg)
  }

  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new Error('AI returned empty text. Try again with clearer instructions.')
  }

  return { text, model: getOpenAiModel(), field }
}
