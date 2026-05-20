import { useMemo, useState } from 'react'
import {
  PURCHASE_EMAIL_SAMPLE,
  buildPurchaseConfirmationHtml,
  buildPurchaseConfirmationText,
  purchaseConfirmationSubject,
} from '../../../shared/purchaseConfirmationEmail.mjs'
import {
  buildQuizResultHtml,
  buildQuizResultText,
  quizResultSubject,
} from '../../../shared/quizResultEmail.mjs'

const EMAIL_TYPES = [
  { id: 'purchase', label: 'Payment receipt (after pay — before quiz)' },
  { id: 'quiz_ok', label: 'Qualified — correct answers + ticket numbers' },
  { id: 'quiz_fail', label: 'Not qualified — incorrect answers' },
]

export function PurchaseEmailPreview() {
  const [emailType, setEmailType] = useState('purchase')
  const [ticketCount, setTicketCount] = useState(5)

  const siteUrl =
    typeof window !== 'undefined' ? window.location.origin : PURCHASE_EMAIL_SAMPLE.siteUrl

  const purchaseSample = useMemo(
    () => ({ ...PURCHASE_EMAIL_SAMPLE, ticketNumbers: [], siteUrl }),
    [siteUrl],
  )

  const quizSample = useMemo(() => {
    const allCorrect = emailType === 'quiz_ok'
    return {
      customerFullName: PURCHASE_EMAIL_SAMPLE.customerFullName,
      allCorrect,
      siteUrl,
      orderRef: allCorrect ? PURCHASE_EMAIL_SAMPLE.purchaseRef : undefined,
      bundleTitle: allCorrect ? PURCHASE_EMAIL_SAMPLE.bundleTitle : undefined,
      quantity: allCorrect ? PURCHASE_EMAIL_SAMPLE.quantity : undefined,
      ticketNumbers: allCorrect
        ? PURCHASE_EMAIL_SAMPLE.ticketNumbers.slice(0, ticketCount)
        : [],
    }
  }, [emailType, siteUrl, ticketCount])

  const { html, text, subject } = useMemo(() => {
    if (emailType === 'purchase') {
      return {
        html: buildPurchaseConfirmationHtml(purchaseSample),
        text: buildPurchaseConfirmationText(purchaseSample),
        subject: purchaseConfirmationSubject(purchaseSample.purchaseRef),
      }
    }
    return {
      html: buildQuizResultHtml(quizSample),
      text: buildQuizResultText(quizSample),
      subject: quizResultSubject(quizSample.allCorrect),
    }
  }, [emailType, purchaseSample, quizSample])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-100">Test email</h1>
          <p className="mt-2 max-w-xl text-sm text-stone-500">
            Paying only confirms payment. Ticket numbers are emailed only if all three skill answers are
            correct. Wrong answers → not qualified, no ticket-number email.
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
          {emailType === 'purchase' ? (
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
          ) : null}
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
              title="Email HTML preview"
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
