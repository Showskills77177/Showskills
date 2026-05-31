import { useState } from 'react'
import { apiFetch } from '../../lib/api'

const FIELD_LABELS = {
  competition_summary: 'summary',
  competition_rules: 'rules',
  bundle_checkout_line: 'checkout line',
}

/**
 * @param {{
 *   field: 'competition_summary' | 'competition_rules' | 'bundle_checkout_line',
 *   value?: string,
 *   onApply: (text: string) => void,
 *   context?: Record<string, unknown>,
 *   compact?: boolean,
 * }} props
 */
export function AdminAiCopyAssistant({ field, value = '', onApply, context = {}, compact = false }) {
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate(mode = 'replace') {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/admin/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          instructions,
          context: { ...context, existingText: value },
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Generation failed')
      const text = typeof j.text === 'string' ? j.text.trim() : ''
      if (!text) throw new Error('AI returned empty text')
      if (mode === 'append' && value.trim()) {
        onApply(`${value.trim()}\n\n${text}`)
      } else {
        onApply(text)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <div className="mt-1">
        <button
          type="button"
          onClick={() => generate('replace')}
          disabled={loading}
          className="rounded border border-violet-500/30 bg-violet-950/30 px-2 py-0.5 text-[10px] font-semibold text-violet-100 hover:bg-violet-950/50 disabled:opacity-50"
          title="Generate checkout line with AI"
        >
          {loading ? '…' : 'AI line'}
        </button>
        {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-violet-500/20 bg-violet-950/15 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-violet-100"
      >
        <span>AI assistant — generate {FIELD_LABELS[field] || 'copy'}</span>
        <span className="text-violet-300/80">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] text-stone-400">
            Tell the AI what you want (optional)
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Mention signed shirt, skill quiz, closing date end of June, premium tone…"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-stone-100"
            />
          </label>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => generate('replace')}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate & replace'}
            </button>
            <button
              type="button"
              disabled={loading || !value.trim()}
              onClick={() => generate('append')}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-stone-300 hover:bg-white/5 disabled:opacity-50"
            >
              Append below current
            </button>
          </div>
          <p className="text-[10px] text-stone-500">
            Uses ChatGPT via OpenAI on the server. Set <code className="text-stone-400">OPENAI_API_KEY</code> in Vercel
            Production. Review before publishing.
          </p>
        </div>
      ) : null}
    </div>
  )
}
