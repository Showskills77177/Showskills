import { useCallback, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { useSpeechDictation } from '../../hooks/useSpeechDictation'

const FIELD_LABELS = {
  competition_summary: 'summary',
  competition_rules: 'rules',
  bundle_checkout_line: 'checkout line',
}

function MicIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v3" />
    </svg>
  )
}

function appendDictation(current, chunk) {
  const base = String(current || '').trimEnd()
  const next = String(chunk || '').trim()
  if (!next) return base
  if (!base) return next
  return `${base} ${next}`
}

function InstructionsField({ instructions, setInstructions, rows = 3, placeholder, id }) {
  const appendTranscript = useCallback(
    (chunk) => {
      setInstructions((prev) => appendDictation(prev, chunk))
    },
    [setInstructions],
  )
  const { listening, supported, speechError, toggle } = useSpeechDictation({
    onAppend: appendTranscript,
    lang: 'en-GB',
  })

  return (
    <div>
      <div className="mt-1 flex gap-2">
        <textarea
          id={id}
          rows={rows}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-stone-100"
        />
        {supported ? (
          <button
            type="button"
            onClick={toggle}
            title={listening ? 'Stop dictation' : 'Dictate with microphone'}
            aria-label={listening ? 'Stop dictation' : 'Start dictation'}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
              listening
                ? 'border-red-500/50 bg-red-950/50 text-red-200 animate-pulse'
                : 'border-violet-500/35 bg-violet-950/40 text-violet-100 hover:bg-violet-950/60'
            }`}
          >
            <MicIcon />
          </button>
        ) : null}
      </div>
      {listening ? <p className="mt-1 text-[10px] text-violet-200/90">Listening… speak your instructions, then tap the mic to stop.</p> : null}
      {speechError ? <p className="mt-1 text-[10px] text-red-400">{speechError}</p> : null}
      {!supported ? (
        <p className="mt-1 text-[10px] text-stone-500">Dictation works in Chrome and Edge on desktop.</p>
      ) : null}
    </div>
  )
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
  const [compactOpen, setCompactOpen] = useState(false)
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
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => generate('replace')}
            disabled={loading}
            className="rounded border border-violet-500/30 bg-violet-950/30 px-2 py-0.5 text-[10px] font-semibold text-violet-100 hover:bg-violet-950/50 disabled:opacity-50"
            title="Generate checkout line with AI"
          >
            {loading ? '…' : 'AI line'}
          </button>
          <button
            type="button"
            onClick={() => setCompactOpen((v) => !v)}
            className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-stone-400 hover:bg-white/5"
          >
            {compactOpen ? 'Hide' : 'Mic / notes'}
          </button>
        </div>
        {compactOpen ? (
          <div className="mt-2 rounded border border-white/10 bg-black/20 p-2">
            <InstructionsField
              id={`ai-instructions-${field}-compact`}
              instructions={instructions}
              setInstructions={setInstructions}
              rows={2}
              placeholder="Optional: dictate or type how this bundle line should read…"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => generate('replace')}
              className="mt-2 rounded bg-violet-700 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate with notes'}
            </button>
          </div>
        ) : null}
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
          <label className="block text-[11px] text-stone-400" htmlFor={`ai-instructions-${field}`}>
            Tell the AI what you want — type or use the microphone
            <InstructionsField
              id={`ai-instructions-${field}`}
              instructions={instructions}
              setInstructions={setInstructions}
              rows={3}
              placeholder="e.g. Mention signed shirt, skill quiz, closing date end of June, premium tone…"
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
            Uses ChatGPT via OpenAI on the server. Add <code className="text-stone-400">OPENAI_API_KEY</code> on Vercel
            Production, then redeploy. Review before publishing.
          </p>
        </div>
      ) : null}
    </div>
  )
}
