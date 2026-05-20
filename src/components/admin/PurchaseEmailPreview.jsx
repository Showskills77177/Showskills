import { useMemo, useState } from 'react'
import { PURCHASE_EMAIL_SAMPLE } from '../../../shared/purchaseConfirmationEmail.mjs'
import {
  buildQuizResultHtml,
  buildQuizResultText,
  quizResultSubject,
} from '../../../shared/quizResultEmail.mjs'

const EMAIL_TYPES = [
  { id: 'quiz_ok', label: 'Entry email — qualified (correct answers)' },
  { id: 'quiz_fail', label: 'Entry email — not qualified (wrong answers)' },
]

export function PurchaseEmailPreview() {
  const [emailType, setEmailType] = useState('quiz_ok')
  const [ticketCount, setTicketCount] = useState(5)

  const siteUrl =
    typeof window !== 'undefined' ? window.location.origin : PURCHASE_EMAIL_SAMPLE.siteUrl

  const sample = useMemo(() => {
    const allCorrect = emailType === 'quiz_ok'
    return {
      customerFullName: PURCHASE_EMAIL_SAMPLE.customerFullName,
      allCorrect,
      siteUrl,
      orderRef: PURCHASE_EMAIL_SAMPLE.purchaseRef,
      bundleTitle: PURCHASE_EMAIL_SAMPLE.bundleTitle,
      quantity: PURCHASE_EMAIL_SAMPLE.quantity,
      amountPence: PURCHASE_EMAIL_SAMPLE.amountPence,
      ticketNumbers: PURCHASE_EMAIL_SAMPLE.ticketNumbers.slice(0, Math.max(1, ticketCount)),
    }
  }, [emailType, siteUrl, ticketCount])

  const html = buildQuizResultHtml(sample)
  const text = buildQuizResultText(sample)
  const subject = quizResultSubject(sample.orderRef, sample.allCorrect)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-100">Test email</h1>
          <p className="mt-2 max-w-xl text-sm text-stone-500">
            One email per paid entry, sent after they submit skill answers. Includes payment
            summary, ticket numbers, and whether they qualified. No separate payment email from
            ShowSkills (Stripe/PayPal may still send their own receipt).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-400">
            Template
            <select
              value={emailType}
              onChange={(e) => setEmailType(e.target.value)}
              className="max-w-[16rem] rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-stone-200"
            >
              {EMAIL_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-400">
            Ticket count
            <select
              value={ticketCount}
              onChange={(e) => setTicketCount(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-stone-200"
            >
              {[1, 3, 5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="text-sm text-stone-500">
        Subject: <span className="font-mono text-stone-300">{subject}</span>
      </p>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">HTML preview</h2>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1a16]">
            <iframe
              title="Entry confirmation email preview"
              srcDoc={html}
              className="h-[min(680px,75vh)] w-full"
              sandbox=""
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Plain text</h2>
          <pre className="max-h-[min(680px,75vh)] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed whitespace-pre-wrap text-stone-400">
            {text}
          </pre>
        </section>
      </div>
    </div>
  )
}
