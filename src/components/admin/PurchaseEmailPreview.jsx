import { useMemo, useState } from 'react'
import { EmailHtmlPreviewFrame } from './EmailHtmlPreviewFrame'
import { AdminCompetitionSelect } from './AdminCompetitionSelect'
import { defaultMainDrawCompetitionSlug, getMainDrawCompetitionLabel } from '../../../shared/adminCompetitions.mjs'
import {
  PURCHASE_EMAIL_SAMPLE,
  buildPurchaseConfirmationHtml,
  buildPurchaseConfirmationText,
  purchaseConfirmationSubjectQuizPending,
} from '../../../shared/purchaseConfirmationEmail.mjs'
import { buildCompleteQuizUrl } from '../../../shared/quizLinks.mjs'
import {
  buildQuizResultHtml,
  buildQuizResultText,
  quizResultSubject,
} from '../../../shared/quizResultEmail.mjs'

const SHIRT_ENTRY_SAMPLE = ['SG-A1B2C3D4', 'SG-E5F60718']

const EMAIL_TYPES = [
  {
    id: 'quiz_pending',
    label: 'Tickets + answer link (left without answering)',
  },
  { id: 'quiz_ok', label: 'Qualified — all answers correct' },
  {
    id: 'quiz_fail_no_consolation',
    label: 'Not qualified — under £10 (no consolation)',
  },
  {
    id: 'quiz_fail_consolation',
    label: 'Not qualified — £10+ with shirt consolation',
  },
]

export function PurchaseEmailPreview() {
  const [emailType, setEmailType] = useState('quiz_pending')
  const [competition, setCompetition] = useState(defaultMainDrawCompetitionSlug())
  const [ticketCount, setTicketCount] = useState(5)

  const siteUrl =
    typeof window !== 'undefined' ? window.location.origin : PURCHASE_EMAIL_SAMPLE.siteUrl

  const ticketNumbers = useMemo(
    () => PURCHASE_EMAIL_SAMPLE.ticketNumbers.slice(0, Math.max(1, ticketCount)),
    [ticketCount],
  )

  const resumeToken = 'PREVIEW_RESUME_TOKEN_SAMPLE_32chars_ok'
  const completeQuizUrl = buildCompleteQuizUrl(siteUrl, resumeToken)

  const { html, text, subject, description } = useMemo(() => {
    if (emailType === 'quiz_pending') {
      const props = {
        customerFullName: PURCHASE_EMAIL_SAMPLE.customerFullName,
        bundleTitle: PURCHASE_EMAIL_SAMPLE.bundleTitle,
        quantity: PURCHASE_EMAIL_SAMPLE.quantity,
        amountPence: PURCHASE_EMAIL_SAMPLE.amountPence,
        ticketNumbers,
        purchaseRef: PURCHASE_EMAIL_SAMPLE.purchaseRef,
        siteUrl,
        quizPending: true,
        completeQuizUrl,
      }
      return {
        html: buildPurchaseConfirmationHtml(props),
        text: buildPurchaseConfirmationText(props),
        subject: purchaseConfirmationSubjectQuizPending(PURCHASE_EMAIL_SAMPLE.purchaseRef),
        description:
          'Sent once if they paid but closed the site before submitting answers. Includes ticket numbers and a personal link (works on any device). Not sent if they already answered in the popup.',
      }
    }

    const allCorrect = emailType === 'quiz_ok'
    const withConsolation = emailType === 'quiz_fail_consolation'
    const underTen = emailType === 'quiz_fail_no_consolation'
    const sample = {
      customerFullName: PURCHASE_EMAIL_SAMPLE.customerFullName,
      allCorrect,
      siteUrl,
      orderRef: PURCHASE_EMAIL_SAMPLE.purchaseRef,
      bundleTitle: underTen ? 'Single ticket' : PURCHASE_EMAIL_SAMPLE.bundleTitle,
      quantity: underTen ? 1 : PURCHASE_EMAIL_SAMPLE.quantity,
      amountPence: underTen ? 750 : withConsolation ? 1000 : PURCHASE_EMAIL_SAMPLE.amountPence,
      ticketNumbers: underTen ? [ticketNumbers[0] || 'SS-12345678'] : ticketNumbers,
      consolationShirtEntries: withConsolation ? 2 : 0,
      consolationShirtEntryNumbers: withConsolation ? SHIRT_ENTRY_SAMPLE : [],
    }
    return {
      html: buildQuizResultHtml(sample),
      text: buildQuizResultText(sample),
      subject: quizResultSubject(sample.orderRef, sample.allCorrect),
      description: allCorrect
        ? 'Sent after correct skill answers. Legacy Bundle ticket numbers enter the main draw pool.'
        : withConsolation
          ? 'Sent after wrong answers on a £10+ purchase. Includes Legacy ticket numbers (not in draw), shirt photo, and 2 SG- entry numbers for the Free Ronaldo Shirt Giveaway.'
          : 'Sent after wrong answers when spend is under £10 in one purchase. No consolation shirt entries — explains the £10 threshold.',
    }
  }, [emailType, siteUrl, ticketCount, ticketNumbers, completeQuizUrl])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-100">Email previews</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AdminCompetitionSelect
            kind="mainDraw"
            value={competition}
            onChange={setCompetition}
            allowAll={false}
            label="Competition context"
          />
          <label className="flex items-center gap-2 text-sm text-stone-400">
            Template
            <select
              value={emailType}
              onChange={(e) => setEmailType(e.target.value)}
              className="max-w-[20rem] rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-stone-200"
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
        Competition context:{' '}
        <span className="text-stone-300">{getMainDrawCompetitionLabel(competition)}</span>
        {competition !== defaultMainDrawCompetitionSlug() ? (
          <span className="text-stone-600">
            {' '}
            — copy still reflects Legacy Bundle until MJ templates are added.
          </span>
        ) : null}
      </p>
      <p className="text-sm text-stone-500">
        Subject: <span className="font-mono text-stone-300">{subject}</span>
      </p>
      {emailType === 'quiz_pending' ? (
        <p className="text-xs text-stone-600">
          Sample resume link:{' '}
          <span className="break-all font-mono text-teal-400/90">{completeQuizUrl}</span>
        </p>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="min-w-0">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
            HTML preview
          </h2>
          <EmailHtmlPreviewFrame html={html} title="Purchase email HTML preview" />
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Plain text
          </h2>
          <pre className="max-h-[min(720px,80vh)] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed whitespace-pre-wrap text-stone-400">
            {text}
          </pre>
        </section>
      </div>
    </div>
  )
}
