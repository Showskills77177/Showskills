import { useSiteLocale } from '../../i18n/SiteLocaleProvider.jsx'

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
  if (entry.quizStatus === 'qualified') return t('auth.quizQualified')
  if (entry.quizStatus === 'not_qualified') return t('auth.quizNotQualified')
  return t('auth.quizPending')
}

function quizStatusClass(entry) {
  if (entry.quizStatus === 'qualified') return 'text-lime-300'
  if (entry.quizStatus === 'not_qualified') return 'text-stone-400'
  return 'text-amber-300'
}

export function EntryHistoryList({ entries, entriesStatus }) {
  const { locale, t } = useSiteLocale()

  if (entriesStatus === 'loading') {
    return <p className="text-sm text-lime-200/55">{t('auth.loadingEntries')}</p>
  }

  if (!entries?.length) {
    return <p className="text-sm leading-relaxed text-lime-200/60">{t('auth.noEntries')}</p>
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-xl border border-lime-500/25 bg-lime-950/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-white">{entry.competitionLabel}</p>
              <p className="mt-0.5 text-sm text-lime-100/80">{entry.bundleTitle}</p>
              <p className="mt-1 text-xs text-lime-200/50">
                {t('auth.entryOrderRef')}:{' '}
                <span className="font-mono text-lime-100/70">{entry.orderRef}</span>
              </p>
            </div>
            <p className={`text-sm font-medium ${quizStatusClass(entry)}`}>
              {quizStatusLabel(entry, t)}
            </p>
          </div>
          <p className="mt-2 text-xs text-lime-200/50">
            {t('auth.entryPurchased')}: {formatPurchasedAt(entry.purchasedAt, locale)} ·{' '}
            {t('auth.entryTickets', { count: entry.quantity })}
          </p>
          {entry.ticketNumbers?.length ? (
            <p className="mt-2 text-xs leading-relaxed text-lime-200/45">
              {entry.ticketNumbers.join(' · ')}
            </p>
          ) : null}
          {entry.quizStatus === 'pending' && entry.quizUrl ? (
            <a
              href={entry.quizUrl}
              className="mt-3 inline-flex rounded-lg bg-lime-500 px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-lime-400"
            >
              {t('auth.completeQuiz')}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
