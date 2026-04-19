import { useId } from 'react'
import { BUNDLE_OFFER_ITEMS, TICKET_BUNDLES, formatBundlePriceGBP } from '../competitionData'

export function TicketBundlePrice({ className = '', compact = false }) {
  if (compact) {
    return (
      <p
        className={`inline-flex w-fit max-w-full flex-wrap items-center rounded-lg border border-emerald-400/30 bg-emerald-950/35 font-display leading-snug tracking-wide text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.12)] ${
          'gap-1 px-2.5 py-1.5 text-xs sm:text-sm'
        } ${className}`}
      >
        From {formatBundlePriceGBP(75)} (single) · bundles to {formatBundlePriceGBP(1800)} (40 tickets)
      </p>
    )
  }

  return (
    <div
      className={`w-full rounded-lg border border-emerald-400/30 bg-emerald-950/35 px-4 py-3 shadow-[0_0_24px_rgba(16,185,129,0.12)] sm:px-5 sm:py-4 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/85">Ticket bundles</p>
      <ul className="mt-3 space-y-2 text-sm leading-snug text-emerald-50/95">
        {TICKET_BUNDLES.map((b) => (
          <li key={b.id} className="flex items-start justify-between gap-3 border-b border-emerald-500/10 pb-2 last:border-0 last:pb-0">
            <span className="min-w-0">
              <span className="mr-1.5" aria-hidden>
                {b.emoji}
              </span>
              <span className="font-medium text-stone-100">{b.title}</span>
              <span className="mt-0.5 block text-xs text-emerald-200/75">{b.line1}</span>
              {b.line2 ? <span className="block text-xs text-stone-500">{b.line2}</span> : null}
            </span>
            <span className="shrink-0 font-display text-base tabular-nums text-white">
              {formatBundlePriceGBP(b.totalPence)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const STAGGER_CLASS = {
  0: '',
  1: 'ss-football-bounce-wrap--stagger-1',
  2: 'ss-football-bounce-wrap--stagger-2',
}

export function GlowingFootballIcon({ className = 'mb-1 shrink-0 sm:mb-1.5', stagger = 0 }) {
  const uid = useId().replace(/:/g, '')
  const gradId = `sfg-${uid}-fill`
  const staggerClass = STAGGER_CLASS[stagger] ?? ''

  return (
    <div className={`ss-football-kickups-cue inline-flex flex-col items-center ${className}`}>
      <div className={`ss-football-bounce-wrap relative h-11 w-11 sm:h-14 sm:w-14 ${staggerClass}`}>
        <svg
          className="ss-football-icon-glow h-full w-full overflow-visible"
          viewBox="0 0 64 66"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={gradId} cx="32%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.45" stopColor="#ecfdf5" />
              <stop offset="1" stopColor="#a7f3d0" stopOpacity="0.85" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="31" r="27" fill={`url(#${gradId})`} stroke="#34d399" strokeWidth="1.75" />
        </svg>
      </div>
      <div className="ss-football-ground" aria-hidden />
    </div>
  )
}

/** Neon envelope; bobs vertically (e.g. Legacy entry flow). */
export function NeonPostalLetter({ className = '' }) {
  const uid = useId().replace(/:/g, '')
  const strokeGrad = `ss-postal-stroke-${uid}`
  const softGlow = `ss-postal-soft-${uid}`

  return (
    <div className={`ss-postal-neon-cue inline-flex flex-col items-center ${className}`}>
      <div className="ss-postal-letter-bounce-wrap relative h-[4.25rem] w-[5.25rem] sm:h-[4.75rem] sm:w-[5.75rem]">
        <svg className="ss-postal-letter-glow h-full w-full overflow-visible" viewBox="0 0 88 72" fill="none" aria-hidden>
          <defs>
            <linearGradient id={strokeGrad} x1="10" y1="8" x2="78" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f8fafc" />
              <stop offset="0.45" stopColor="#5eead4" />
              <stop offset="1" stopColor="#34d399" />
            </linearGradient>
            <filter id={softGlow} x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="1.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect
            x="14"
            y="22"
            width="60"
            height="40"
            rx="4"
            stroke={`url(#${strokeGrad})`}
            strokeWidth="2.25"
            fill="rgba(15, 23, 42, 0.55)"
            filter={`url(#${softGlow})`}
          />
          <path
            d="M 14 22 L 44 46 L 74 22"
            stroke={`url(#${strokeGrad})`}
            strokeWidth="2.25"
            strokeLinejoin="round"
            fill="none"
            filter={`url(#${softGlow})`}
          />
          <path
            d="M 14 62 L 36 44 L 52 44 L 74 62"
            stroke={`url(#${strokeGrad})`}
            strokeWidth="1.85"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.85"
          />
        </svg>
      </div>
      <div className="ss-postal-ground" aria-hidden />
    </div>
  )
}

const K35_SIZE_CLASS = {
  md: 'h-[5.85rem] w-[5.85rem] sm:h-[6.75rem] sm:w-[6.75rem]',
  lg: 'h-[7.35rem] w-[7.35rem] sm:h-[8.5rem] sm:w-[8.5rem]',
}

/** Champagne-gold neon ball with centered “35” (Kick-Ups CTA). */
export function KickupsNeonBall35({ className = '', size = 'md' }) {
  const uid = useId().replace(/:/g, '')
  const fillGrad = `ss-k35-fill-${uid}`
  const numShadow = `ss-k35-num-${uid}`
  const dim = K35_SIZE_CLASS[size] ?? K35_SIZE_CLASS.md
  const groundClass =
    size === 'lg' ? 'ss-kickups-35-ground ss-kickups-35-ground--lg' : 'ss-kickups-35-ground'

  return (
    <div className={`ss-kickups-35-cue inline-flex flex-col items-center ${className}`}>
      <div className={`ss-football-bounce-wrap relative ${dim}`}>
        <svg
          className="ss-kickups-35-ball-glow h-full w-full overflow-visible"
          viewBox="0 0 88 90"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={fillGrad} cx="35%" cy="26%" r="72%">
              <stop offset="0%" stopColor="#fffef5" stopOpacity="1" />
              <stop offset="0.28" stopColor="#fef9c3" stopOpacity="1" />
              <stop offset="0.52" stopColor="#fde047" stopOpacity="0.98" />
              <stop offset="0.78" stopColor="#eab308" stopOpacity="0.95" />
              <stop offset="1" stopColor="#a16207" stopOpacity="0.96" />
            </radialGradient>
            <filter id={numShadow} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="0.5"
                stdDeviation="0.85"
                floodColor="#713f12"
                floodOpacity="0.28"
                result="k35soft"
              />
              <feMerge>
                <feMergeNode in="k35soft" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="44" cy="38" r="32" fill={`url(#${fillGrad})`} stroke="#fef08a" strokeWidth="2" />
          <circle
            cx="44"
            cy="38"
            r="32"
            fill="none"
            stroke="rgba(253, 224, 71, 0.55)"
            strokeWidth="1.2"
          />
          <text
            x="44"
            y="40"
            textAnchor="middle"
            dominantBaseline="central"
            className="font-display font-bold"
            fill="#fffbeb"
            stroke="#ca8a04"
            strokeWidth="1.5"
            paintOrder="stroke fill"
            strokeLinejoin="round"
            strokeLinecap="round"
            fontSize="27"
            letterSpacing="-0.02em"
            filter={`url(#${numShadow})`}
          >
            35
          </text>
        </svg>
      </div>
      <div className={groundClass} aria-hidden />
    </div>
  )
}

/** Home-only: gradient CTA for the 35 Kick-Ups shirt giveaway. */
export function ShirtGiveawayCtaButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative mx-auto w-full max-w-[25.2rem] overflow-hidden rounded-xl bg-gradient-to-r from-lime-600 to-emerald-700 py-3 shadow-lg transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#052e1a] ${className}`}
    >
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-white/[0.07]"
        aria-hidden
      />
      <span className="relative z-[1] mx-auto flex min-h-[2.5rem] items-center justify-center px-4 text-center sm:min-h-[2.75rem] sm:px-5">
        <span className="whitespace-nowrap font-display text-xl leading-none tracking-tight text-white sm:text-2xl">
          Enter shirt giveaway
        </span>
      </span>
    </button>
  )
}

export function SkillMeterIcon({ className = 'h-5 w-5 text-emerald-300', ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...rest}>
      <rect x="3" y="15" width="3.5" height="6" rx="0.75" fill="currentColor" opacity="0.28" />
      <rect x="8.25" y="11" width="3.5" height="10" rx="0.75" fill="currentColor" opacity="0.48" />
      <rect x="13.5" y="7" width="3.5" height="14" rx="0.75" fill="currentColor" opacity="0.72" />
      <rect x="18.75" y="4" width="2.25" height="17" rx="0.75" fill="currentColor" />
    </svg>
  )
}

export function BundleOfferCopy({ compact = false }) {
  return (
    <div>
      <p
        className={`font-semibold text-stone-400 ${compact ? 'mb-2 text-[10px] sm:text-xs' : 'mb-3 text-xs sm:text-sm'}`}
      >
        What&apos;s included
      </p>
      <ul className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
        {BUNDLE_OFFER_ITEMS.map((line) => (
          <li
            key={line}
            className={`flex gap-3 leading-snug ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'} text-stone-200`}
          >
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-500/70" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
