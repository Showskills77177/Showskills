import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmailHtmlPreviewFrame } from './EmailHtmlPreviewFrame'
import { WorldCupBallClaimForm } from '../WorldCupBallClaimForm'
import { WorldCupBallPrizeFrame } from '../WorldCupBallPrizeFrame'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from '../../../shared/worldCupBallGiveaway.mjs'
import { buildWorldCupBallClaimUrl } from '../../../shared/worldCupBallClaim.mjs'
import { DEV_PREVIEW_WC_BALL_CLAIM_TOKEN } from '../../../shared/devEmailPreview.mjs'
import {
  buildWorldCupBallWinnerEmailHtml,
  buildWorldCupBallWinnerEmailText,
  worldCupBallWinnerEmailSubject,
} from '../../../shared/worldCupBallWinnerEmail.mjs'

const PREVIEW_TYPES = [
  { id: 'winner_complete', label: 'Winner email — details saved' },
  { id: 'winner_pending', label: 'Winner email — complete your details' },
  { id: 'claim_form', label: 'Winner delivery form' },
  { id: 'claim_success', label: 'Delivery form — success state' },
]

const SAMPLE = {
  customerFullName: 'Alex Morgan',
  customerPhone: '+447700900456',
  winReference: 'WC-A1B2C3D4',
  wonAt: new Date().toISOString(),
}

export function WorldCupBallGiveawayPreview() {
  const [previewType, setPreviewType] = useState('claim_form')

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const claimUrl = buildWorldCupBallClaimUrl(siteUrl, DEV_PREVIEW_WC_BALL_CLAIM_TOKEN)

  const { html, text, subject, description } = useMemo(() => {
    const detailsComplete = previewType === 'winner_complete'
    const emailProps = {
      ...SAMPLE,
      siteUrl,
      claimUrl,
      detailsComplete,
      forBrowserPreview: true,
    }
    return {
      html: buildWorldCupBallWinnerEmailHtml(emailProps),
      text: buildWorldCupBallWinnerEmailText(emailProps),
      subject: worldCupBallWinnerEmailSubject(detailsComplete),
      description: detailsComplete
        ? 'Sent after the winner saves their delivery details on the claim form.'
        : 'Sent when the winner requests a link by email before completing the form.',
    }
  }, [previewType, siteUrl, claimUrl])

  const isEmail = previewType === 'winner_complete' || previewType === 'winner_pending'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-100">World Cup Ball giveaway</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            {isEmail
              ? description
              : previewType === 'claim_form'
                ? 'The form winners complete after a perfect quiz score — shown in the entry modal on the live site.'
                : 'What winners see after submitting their delivery details.'}
          </p>
        </div>
        <label htmlFor="wc-ball-preview-type" className="flex items-center gap-2 text-sm text-stone-400">
          Preview
          <select
            id="wc-ball-preview-type"
            value={previewType}
            onChange={(e) => setPreviewType(e.target.value)}
            className="max-w-[22rem] rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-stone-200"
          >
            {PREVIEW_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isEmail ? (
        <>
          <p className="text-sm text-stone-500">
            Subject: <span className="font-mono text-stone-300">{subject}</span>
          </p>
          <p className="text-xs text-stone-600">
            Sample claim link: <span className="break-all font-mono text-amber-400/90">{claimUrl}</span>
          </p>
          <div className="grid gap-8 xl:grid-cols-2">
            <section className="min-w-0">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">HTML preview</h2>
              <EmailHtmlPreviewFrame html={html} title="World Cup Ball winner email" />
            </section>
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Plain text</h2>
              <pre className="max-h-[min(720px,80vh)] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed whitespace-pre-wrap text-stone-400">
                {text}
              </pre>
            </section>
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-lg">
          <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-100/90">
            Preview only — the form will not save. On the live site this appears in the entry modal after a perfect
            score, or via the winner email link.
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-stone-950 shadow-2xl">
            <div className="h-1 w-full bg-gradient-to-r from-amber-500/80 via-yellow-500/60 to-transparent" aria-hidden />
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-stone-100">Enter — {WORLD_CUP_BALL_GIVEAWAY_LABEL}</h2>
            </div>
            <div className="max-h-[min(80vh,720px)] overflow-y-auto px-5 py-4">
              <WorldCupBallPrizeFrame variant="compact" showChips={false} className="mx-auto mb-6 w-full max-w-[14rem]" />
              {previewType === 'claim_success' ? (
                <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-sm text-amber-50/95">
                  <p className="font-semibold text-amber-100">Details received — congratulations again!</p>
                  <p className="mt-2 text-stone-300">
                    We have sent a winner confirmation email with a personal link back to this form. Your delivery
                    details are saved and we will arrange free UK shipping of your World Cup ball.
                  </p>
                </div>
              ) : (
                <WorldCupBallClaimForm
                  claimToken={DEV_PREVIEW_WC_BALL_CLAIM_TOKEN}
                  onOpenTerms={() => {}}
                  onClaimed={() => {}}
                  onError={() => {}}
                  preview
                />
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-stone-600">
            <Link to="/world-cup-ball-giveaway" className="text-amber-400/90 underline underline-offset-2">
              Rules page
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
