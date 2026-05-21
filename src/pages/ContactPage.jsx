import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { CONTACT_TOPICS, SHOWSKILLS_CONTACT_EMAIL } from '../../shared/siteContact.mjs'
import { apiUrl } from '../lib/api'

const inputClass =
  'mt-2 w-full rounded-xl border border-white/10 bg-[#071512]/80 px-4 py-3 text-[15px] text-stone-100 shadow-inner shadow-black/20 outline-none transition placeholder:text-stone-600 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/25'

const labelClass = 'block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('general')
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('sending')
    try {
      const res = await fetch(apiUrl('/api/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, topic, message, company }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || `Could not send (HTTP ${res.status}).`)
        setStatus('error')
        return
      }
      setStatus('sent')
      setName('')
      setEmail('')
      setMessage('')
      setTopic('general')
    } catch {
      setError('Network error. Check your connection and try again.')
      setStatus('error')
    }
  }

  return (
    <main className="m-0 p-0">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400/90">Get in touch</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white sm:text-5xl">
          Contact us
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-400 sm:text-lg">
          Questions about the Ronaldo Legacy Bundle, paid tickets, postal entry, or the shirt giveaway? Send a
          message below and we will reply to the email you provide.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-stone-950/50 px-4 py-3.5 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-950/80 text-teal-400 ring-1 ring-teal-500/30">
            <Mail className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-stone-400">
            Prefer email? Write to{' '}
            <a
              href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`}
              className="font-medium text-teal-300 underline decoration-teal-600/40 underline-offset-[3px] transition hover:text-teal-200"
            >
              {SHOWSKILLS_CONTACT_EMAIL}
            </a>
          </p>
        </div>

        {status === 'sent' ? (
          <div
            className="mt-10 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/50 to-stone-950/80 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
            role="status"
          >
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" aria-hidden />
            <div className="px-6 py-8 sm:px-8 sm:py-10">
              <p className="font-display text-2xl uppercase tracking-wide text-emerald-100">Message sent</p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-200/85 sm:text-base">
                Thank you. We have received your message and will respond to your email address as soon as we can.
              </p>
              <Link
                to="/competitions"
                className="mt-6 inline-flex items-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
              >
                Back to competitions
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-10 overflow-hidden rounded-2xl border border-teal-500/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-teal-500/60 to-transparent" aria-hidden />
            <form onSubmit={onSubmit} className="space-y-6 px-5 py-8 sm:px-8 sm:py-10">
              <input
                type="text"
                name="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <label className={labelClass}>
                  Topic
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    className={`${inputClass} cursor-pointer`}
                  >
                    {CONTACT_TOPICS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Your name
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Full name"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Message
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  maxLength={5000}
                  rows={6}
                  placeholder="Tell us what you need help with…"
                  className={`${inputClass} min-h-[9rem] resize-y leading-relaxed`}
                />
              </label>

              {error ? (
                <p
                  className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="border-t border-white/[0.06] pt-6">
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-bold tracking-wide text-emerald-950 shadow-lg shadow-emerald-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55 sm:text-base"
                >
                  {status === 'sending' ? 'Sending…' : 'Send message'}
                </button>
                <p className="mt-4 text-center text-xs leading-relaxed text-stone-600">
                  We typically reply by email. For urgent payment issues, include your order reference if you have one.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
