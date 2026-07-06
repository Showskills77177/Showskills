import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiteLocale } from '../../i18n/SiteLocaleProvider.jsx'
import { apiFetch } from '../../lib/api'
import { formatBundlePriceGBP } from '../../../shared/ticketBundles.mjs'

function formatPurchasedAt(value, locale) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(locale || undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return String(value)
  }
}

function quizStatusLabel(entry, t) {
  if (entry.kind === 'world_cup_ball') {
    if (entry.wcBallStatus === 'won' || entry.wcBallStatus === 'claimed') return t('auth.quizQualified')
    if (entry.wcBallStatus === 'in_progress') return t('auth.quizPending')
    return t('auth.quizNotQualified')
  }
  if (entry.quizStatus === 'qualified') return t('auth.quizQualified')
  if (entry.quizStatus === 'not_qualified') return t('auth.quizNotQualified')
  if (entry.quizStatus === 'pending') return t('auth.quizPending')
  return t('auth.freeGiveaway')
}

function quizStatusClass(entry) {
  if (entry.quizStatus === 'qualified' || entry.wcBallStatus === 'won' || entry.wcBallStatus === 'claimed') {
    return 'text-lime-300'
  }
  if (entry.quizStatus === 'not_qualified' || entry.wcBallStatus === 'lost') return 'text-stone-400'
  if (entry.quizStatus === 'pending' || entry.wcBallStatus === 'in_progress') return 'text-amber-300'
  return 'text-lime-200/70'
}

function entryKindLabel(entry, t) {
  if (entry.kind === 'shirt_giveaway') return t('auth.entryKindShirt')
  if (entry.kind === 'world_cup_ball') return t('auth.entryKindWorldCup')
  return t('auth.entryKindPaid')
}

function EntryCard({ entry, locale, t, onResendDone, onResendError }) {
  const [resending, setResending] = useState(false)
  const ticketNumbers = entry.ticketNumbers?.length ? entry.ticketNumbers : entry.entryNumbers

  async function onResendEmail() {
    if (!entry.canResendEmail || entry.kind !== 'paid_ticket') return
    setResending(true)
    try {
      const res = await apiFetch('/api/auth/resend-entry-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: entry.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onResendError(data.error || t('form.networkError'))
        return
      }
      onResendDone(t('auth.emailResent'))
    } catch {
      onResendError(t('form.networkError'))
    } finally {
      setResending(false)
    }
  }

  return (
    <li className="rounded-xl border border-lime-500/25 bg-lime-950/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-lime-300/80">
            {entryKindLabel(entry, t)}
          </p>
          <p className="font-semibold text-white">{entry.competitionLabel}</p>
          {entry.bundleTitle && entry.bundleTitle !== entry.competitionLabel ? (
            <p className="mt-0.5 text-sm text-lime-100/80">{entry.bundleTitle}</p>
          ) : null}
          {entry.orderRef ? (
            <p className="mt-1 text-xs text-lime-200/50">
              {t('auth.entryOrderRef')}:{' '}
              <span className="font-mono text-lime-100/70">{entry.orderRef}</span>
            </p>
          ) : null}
        </div>
        <p className={`text-sm font-medium ${quizStatusClass(entry)}`}>{quizStatusLabel(entry, t)}</p>
      </div>

      <p className="mt-2 text-xs text-lime-200/50">
        {t('auth.entryPurchased')}: {formatPurchasedAt(entry.purchasedAt, locale)}
        {entry.kind === 'paid_ticket' && entry.quantity ? (
          <> · {t('auth.entryTickets', { count: entry.quantity })}</>
        ) : null}
        {entry.kind === 'paid_ticket' && entry.amountPence > 0 ? (
          <>
            {' '}
            · {t('auth.amountPaid')}: {formatBundlePriceGBP(entry.amountPence)}
          </>
        ) : null}
      </p>

      {ticketNumbers?.length ? (
        <p className="mt-2 text-xs leading-relaxed text-lime-200/45">{ticketNumbers.join(' · ')}</p>
      ) : null}

      {entry.consolationEntryNumbers?.length ? (
        <p className="mt-2 text-xs text-lime-200/60">
          {t('auth.consolationEntries')}: {entry.consolationEntryNumbers.join(' · ')}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.quizStatus === 'pending' && entry.quizUrl ? (
          <a
            href={entry.quizUrl}
            className="inline-flex rounded-lg bg-lime-500 px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-lime-400"
          >
            {t('auth.completeQuiz')}
          </a>
        ) : null}
        {entry.prizeRevealUrl ? (
          <a
            href={entry.prizeRevealUrl}
            className="inline-flex rounded-lg border border-lime-400/40 bg-lime-950/40 px-3 py-2 text-sm font-semibold text-lime-100 transition hover:border-lime-300/60"
          >
            {t('auth.viewPrizeReveal')}
          </a>
        ) : null}
        {entry.prizeRevealViewed && entry.quizStatus === 'qualified' ? (
          <span className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-xs text-lime-200/55">
            {t('auth.prizeRevealViewed')}
          </span>
        ) : null}
        {entry.claimUrl ? (
          <a
            href={entry.claimUrl}
            className="inline-flex rounded-lg bg-lime-500 px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-lime-400"
          >
            {t('auth.wcBallClaim')}
          </a>
        ) : null}
        {entry.kind === 'world_cup_ball' && entry.wcBallStatus === 'lost' && entry.giveawayPath ? (
          <Link
            to={entry.giveawayPath}
            className="inline-flex rounded-lg border border-lime-400/40 px-3 py-2 text-sm text-lime-100 transition hover:border-lime-300/60"
          >
            {t('auth.wcBallRetry')}
          </Link>
        ) : null}
        {entry.canResendEmail ? (
          <button
            type="button"
            onClick={onResendEmail}
            disabled={resending}
            className="inline-flex rounded-lg border border-white/15 px-3 py-2 text-sm text-lime-100 transition hover:border-white/25 hover:bg-white/5 disabled:opacity-60"
          >
            {resending ? t('auth.resendingEmail') : t('auth.resendEmail')}
          </button>
        ) : null}
      </div>
    </li>
  )
}

export function EntryHistoryList({ entries, entriesStatus, onMessage }) {
  const { locale, t } = useSiteLocale()

  if (entriesStatus === 'loading') {
    return <p className="text-sm text-lime-200/55">{t('auth.loadingEntries')}</p>
  }

  if (!entries?.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-lime-200/60">{t('auth.noEntries')}</p>
        <Link
          to="/competitions"
          className="inline-flex rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-lime-400"
        >
          {t('auth.viewCompetitions')}
        </Link>
      </div>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <EntryCard
          key={`${entry.kind}-${entry.id}`}
          entry={entry}
          locale={locale}
          t={t}
          onResendDone={(msg) => onMessage?.({ info: msg })}
          onResendError={(err) => onMessage?.({ error: err })}
        />
      ))}
    </ul>
  )
}
