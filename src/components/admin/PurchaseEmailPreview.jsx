import { useMemo, useState } from 'react'
import {
  PURCHASE_EMAIL_SAMPLE,
  buildPurchaseConfirmationHtml,
  buildPurchaseConfirmationText,
  purchaseConfirmationSubject,
} from '../../../shared/purchaseConfirmationEmail.mjs'

export function PurchaseEmailPreview() {
  const [ticketCount, setTicketCount] = useState(5)
  const sample = useMemo(() => {
    const tickets = PURCHASE_EMAIL_SAMPLE.ticketNumbers.slice(0, Math.max(1, ticketCount))
    const siteUrl =
      typeof window !== 'undefined' ? window.location.origin : PURCHASE_EMAIL_SAMPLE.siteUrl
    return { ...PURCHASE_EMAIL_SAMPLE, ticketNumbers: tickets, quantity: tickets.length, siteUrl }
  }, [ticketCount])

  const html = buildPurchaseConfirmationHtml(sample)
  const text = buildPurchaseConfirmationText(sample)
  const subject = purchaseConfirmationSubject(sample.purchaseRef)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-100">Test email</h1>
          <p className="mt-2 max-w-xl text-sm text-stone-500">
            Preview of the purchase confirmation email sent after a paid ticket checkout. Logo loads from{' '}
            <code className="text-stone-400">/email/showskills-logo.png</code> on your live site.
          </p>
        </div>
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

      <p className="text-sm text-stone-500">
        Subject line: <span className="font-mono text-stone-300">{subject}</span>
      </p>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">HTML preview</h2>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1a16]">
            <iframe
              title="Purchase email HTML preview"
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
