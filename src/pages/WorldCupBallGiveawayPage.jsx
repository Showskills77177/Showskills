import { Link } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_PRIZE_DETAIL,
  WORLD_CUP_BALL_PRIZE_TITLE,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION,
  WORLD_CUP_BALL_QUESTION_TIMING_NOTICE,
} from '../../shared/worldCupBallGiveaway.mjs'
import {
  WORLD_CUP_BALL_PUBLIC_STEPS,
  WORLD_CUP_BALL_RULES_INTRO,
  WORLD_CUP_BALL_RULES_SECTIONS,
  WORLD_CUP_BALL_SKILL_NOTICE,
  WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT,
  WORLD_CUP_BALL_GIVEAWAY_PAGE_ID,
  mergeWorldCupBallGiveawayPageLayout,
} from '../../shared/worldCupBallGiveawayRules.mjs'
import { usePageLayout } from '../hooks/useSitePages'
import { WorldCupBallPrizeFrame } from '../components/WorldCupBallPrizeFrame'
import { WorldCupBallTimingCallout } from '../components/WorldCupBallTimingCallout'
import { WorldCupBallGiveawayBackdrop } from '../components/WorldCupBallGiveawayBackdrop'

function HostNationsBadge() {
  return (
    <p className="ss-wc-ball-giveaway-page__hosts inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-amber-300/35 bg-black/45 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-100 backdrop-blur-sm sm:text-[11px]">
      <span className="ss-wc-ball-giveaway-page__hosts-pulse h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
      <span>FIFA World Cup 2026</span>
      <span className="text-amber-300/50" aria-hidden>
        ·
      </span>
      <span className="text-amber-200/90">USA · Canada · Mexico</span>
    </p>
  )
}

function StartQuizButton({ onClick, label, editorMode, variant = 'primary' }) {
  const className =
    variant === 'primary'
      ? 'ss-wc-ball-giveaway-page__cta ss-wc-ball-giveaway-page__cta--primary'
      : 'ss-wc-ball-giveaway-page__cta ss-wc-ball-giveaway-page__cta--secondary'

  return (
    <button type="button" onClick={onClick} className={className} tabIndex={editorMode ? -1 : undefined}>
      {label}
    </button>
  )
}

/** Rules and entry hub for the World Cup Ball Giveaway. */
export default function WorldCupBallGiveawayPage({ layout: layoutProp = null, editorMode = false }) {
  const { openEntry } = useEntryFlow()
  const { layout: fetchedLayout } = usePageLayout(WORLD_CUP_BALL_GIVEAWAY_PAGE_ID)
  const layout = mergeWorldCupBallGiveawayPageLayout(layoutProp || fetchedLayout)
  const ctaLabel = layout.ctaButtonLabel || 'Start the timed quiz'

  const handleStart = () => openEntry('worldCupBall')

  return (
    <main
      className={`ss-wc-ball-giveaway-page relative m-0 overflow-x-hidden p-0 ${
        editorMode ? 'ss-page-editor-preview [&_button:not([data-editor-ui])]:pointer-events-none' : ''
      }`}
    >
      <WorldCupBallGiveawayBackdrop />

      {/* Hero */}
      <section className="ss-wc-ball-giveaway-page__hero relative">
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(260px,420px)] lg:gap-12">
            <div className="min-w-0 text-left">
              <HostNationsBadge />

              <p className="mt-5 font-display text-xs font-bold uppercase tracking-[0.32em] text-amber-300/90 sm:text-sm">
                {layout.badge || 'Free skill challenge'}
              </p>

              <h1 className="ss-wc-ball-giveaway-page__title font-display mt-3 text-[clamp(2.5rem,10vw,4.5rem)] uppercase leading-[0.92] tracking-[0.02em] text-amber-100">
                {layout.title || WORLD_CUP_BALL_GIVEAWAY_LABEL}
              </h1>

              <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-amber-50/88 sm:text-lg">
                {layout.intro || WORLD_CUP_BALL_RULES_INTRO}
              </p>

              <div className="mt-6 max-w-md">
                <WorldCupBallTimingCallout />
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="ss-wc-ball-giveaway-page__pill">Free UK entry</span>
                <span className="ss-wc-ball-giveaway-page__pill">{WORLD_CUP_BALL_QUESTION_COUNT} skill questions</span>
                <span className="ss-wc-ball-giveaway-page__pill ss-wc-ball-giveaway-page__pill--gold">Win outright</span>
                <span className="ss-wc-ball-giveaway-page__pill">Monthly draw if you miss</span>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <StartQuizButton onClick={handleStart} label={ctaLabel} editorMode={editorMode} variant="primary" />
                <a href="#how-to-enter" className="ss-wc-ball-giveaway-page__scroll-link text-center text-sm font-semibold text-amber-300/90 underline-offset-4 hover:text-amber-200 hover:underline sm:text-left">
                  How it works ↓
                </a>
              </div>
            </div>

            <div className="ss-wc-ball-giveaway-page__prize-spotlight relative mx-auto w-full max-w-[22rem] lg:max-w-none">
              <div className="ss-wc-ball-giveaway-page__prize-ring" aria-hidden />
              <WorldCupBallPrizeFrame variant="hero" className="relative z-[1] w-full" />
              <p className="relative z-[1] mt-4 text-center text-sm font-semibold text-amber-100/90">{WORLD_CUP_BALL_PRIZE_TITLE}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="ss-wc-ball-giveaway-page__body relative border-t border-amber-400/15">
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-12">
            <div className="flex min-w-0 flex-col gap-8">
              <div className="ss-wc-ball-giveaway-page__glass grid gap-5 rounded-2xl p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8 sm:p-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/95">The prize</p>
                  <p className="mt-2 text-lg font-semibold leading-snug text-white">{WORLD_CUP_BALL_PRIZE_TITLE}</p>
                  <p className="mt-2 text-sm leading-relaxed text-amber-100/75">{WORLD_CUP_BALL_PRIZE_DETAIL}</p>
                </div>
                <WorldCupBallPrizeFrame variant="thumb" showChips={false} className="mx-auto w-full max-w-[10rem] shrink-0 sm:mx-0" />
              </div>

              <div id="how-to-enter">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/85">
                  {layout.howToTitle || 'How it works'}
                </p>
                <ol className="mt-5 grid list-none gap-3">
                  {WORLD_CUP_BALL_PUBLIC_STEPS.map((step) => (
                    <li key={step.num} className="ss-wc-ball-giveaway-page__step flex gap-4 rounded-2xl p-4 sm:p-5">
                      <span className="ss-wc-ball-giveaway-page__step-num mt-0.5 shrink-0" aria-hidden>
                        {step.num}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-base tracking-tight text-white sm:text-lg">{step.title}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-amber-100/72">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="ss-wc-ball-giveaway-page__glass rounded-2xl p-5 sm:p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/90">Full rules</p>
                <div className="mt-5 space-y-5">
                  {WORLD_CUP_BALL_RULES_SECTIONS.map((section) => (
                    <div key={section.title} className="border-b border-white/6 pb-5 last:border-0 last:pb-0">
                      <h2 className="text-sm font-semibold text-amber-50">{section.title}</h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{section.body}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs leading-relaxed text-stone-500">
                  {WORLD_CUP_BALL_QUESTION_TIMING_NOTICE} {WORLD_CUP_BALL_SKILL_NOTICE}
                </p>
              </div>

              <div className="flex w-full justify-center lg:hidden">
                <StartQuizButton onClick={handleStart} label={ctaLabel} editorMode={editorMode} variant="primary" />
              </div>
            </div>

            <aside className="ss-wc-ball-giveaway-page__aside mx-auto w-full max-w-[360px] rounded-2xl p-5 lg:sticky lg:top-24 lg:mx-0 lg:max-w-none lg:self-start lg:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/90">Ready to play?</p>
              <p className="mt-3 text-xl font-semibold leading-snug text-white">
                {WORLD_CUP_BALL_QUESTION_COUNT} difficult football questions
              </p>
              <p className="mt-3 text-sm leading-relaxed text-amber-200/75">
                Answer every question correctly — {WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION} — to win the ball
                immediately. {WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT}. No VPNs. You only share your name, phone,
                and address if you win.
              </p>
              <StartQuizButton onClick={handleStart} label={ctaLabel} editorMode={editorMode} variant="secondary" />
              <p className="mt-4 text-center text-xs text-stone-500">
                <Link to="/faq" className="text-amber-400/90 underline underline-offset-2 hover:text-amber-300">
                  Common questions (FAQ)
                </Link>
              </p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
