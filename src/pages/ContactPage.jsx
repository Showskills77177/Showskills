import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { CONTACT_TOPICS, SHOWSKILLS_CONTACT_EMAIL, contactTopicLabel } from '../../shared/siteContact.mjs'

const inputClass =
  'mt-2 w-full rounded-xl border border-white/10 bg-[#071512]/80 px-4 py-3 text-base text-stone-100 shadow-inner shadow-black/20 outline-none transition placeholder:text-stone-600 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/25'

const labelClass = 'block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500'

function buildContactMailto({ name, email, topic, message }) {
  const subject = `[ShowSkills] ${contactTopicLabel(topic)} — ${name.trim()}`
  const body = [
    message.trim(),
    '',
    '—',
    name.trim(),
    email.trim(),
  ].join('\n')
  return `mailto:${SHOWSKILLS_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('general')
  const [message, setMessage] = useState('')
  const [hint, setHint] = useState('')

  function onOpenEmail(e) {
    e.preventDefault()
    setHint('')
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedMessage = message.trim()

    if (trimmedName.length < 2) {
      setHint('Please enter your name.')
      return
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setHint('Please enter a valid email address.')
      return
    }
    if (trimmedMessage.length < 10) {
      setHint('Please enter a message (at least 10 characters).')
      return
    }

    window.location.href = buildContactMailto({
      name: trimmedName,
      email: trimmedEmail,
      topic,
      message: trimmedMessage,
    })
  }

  return (
    <main className="m-0 p-0">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400/90">Get in touch</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white sm:text-5xl">
          Contact us
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-400 sm:text-lg">
          Questions about the Ronaldo Legacy Bundle, paid tickets, or postal entry? Fill in the form below, then
          open your email app — your message goes to{' '}
          <strong className="text-stone-300">{SHOWSKILLS_CONTACT_EMAIL}</strong> (we use email forwarding to reply).
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-teal-500/25 bg-teal-950/30 px-4 py-3.5 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-950/80 text-teal-400 ring-1 ring-teal-500/30">
            <Mail className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-stone-300">
            Or email us directly:{' '}
            <a
              href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`}
              className="font-medium text-teal-300 underline decoration-teal-600/40 underline-offset-[3px] hover:text-teal-200"
            >
              {SHOWSKILLS_CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-teal-500/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-teal-500/60 to-transparent" aria-hidden />
          <form onSubmit={onOpenEmail} noValidate className="ss-contact-form space-y-6 px-5 py-8 sm:px-8 sm:py-10">
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
              Your email (so we can reply)
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
                minLength={10}
                maxLength={5000}
                rows={6}
                placeholder="Tell us what you need help with…"
                className={`${inputClass} min-h-[9rem] resize-y leading-relaxed`}
              />
            </label>

            {hint ? (
              <p
                className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
                role="alert"
              >
                {hint}
              </p>
            ) : null}

            <div className="border-t border-white/[0.06] pt-6">
              <button
                type="submit"
                className="min-h-[44px] w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-base font-bold tracking-wide text-emerald-950 shadow-lg shadow-emerald-950/40 transition hover:brightness-110"
              >
                Open email app to send
              </button>
              <p className="mt-4 text-center text-xs leading-relaxed text-stone-500">
                This opens Gmail, Apple Mail, or Outlook with your message addressed to {SHOWSKILLS_CONTACT_EMAIL}.
                Tap send in that app to deliver it.
              </p>
              <p className="mt-3 text-center">
                <Link
                  to="/competitions"
                  className="text-sm font-medium text-stone-500 underline underline-offset-2 hover:text-stone-300"
                >
                  Back to competitions
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
