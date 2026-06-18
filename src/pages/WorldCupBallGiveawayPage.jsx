import { Link } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_GIVEAWAY_PATH,
  WORLD_CUP_BALL_PRIZE_DETAIL,
  WORLD_CUP_BALL_PRIZE_TITLE,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_QUESTION_SECONDS,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
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

/** Rules and entry hub for the World Cup Ball Giveaway. */
export default function WorldCupBallGiveawayPage({ layout: layoutProp = null, editorMode = false }) {
  const { openEntry } = useEntryFlow()
  const { layout: fetchedLayout } = usePageLayout(WORLD_CUP_BALL_GIVEAWAY_PAGE_ID)
  const layout = mergeWorldCupBallGiveawayPageLayout(layoutProp || fetchedLayout)

  return (
    <main
      className={`m-0 p-0 ${editorMode ? 'ss-page-editor-preview [&_button:not([data-editor-ui])]:pointer-events-none' : ''}`}
    >
      <section className="ss-rules-pitch-guide border-t border-amber-400/20">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <header className="max-w-3xl text-left">
            <p className="font-display text-sm font-bold uppercase tracking-[0.35em] text-amber-300/90 drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]">
              {layout.badge}
            </p>
            <h1 className="ss-rules-title font-display mt-2 text-[clamp(2.75rem,9vw,4.25rem)] uppercase leading-[0.95] tracking-[0.02em] text-amber-300">
              {layout.title || WORLD_CUP_BALL_GIVEAWAY_LABEL}
            </h1>
            <p className="mt-4 text-base font-medium leading-relaxed text-amber-50/85 sm:text-lg">
              {layout.intro || WORLD_CUP_BALL_RULES_INTRO}
            </p>
          </header>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-start lg:gap-14">
            <div className="flex min-w-0 flex-col gap-8">
              <div className="flex flex-col gap-5 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/50 via-[#1a1408] to-black/40 p-4 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
                <WorldCupBallPrizeFrame variant="thumb" showChips={false} className="mx-auto w-full max-w-[11rem] shrink-0 sm:mx-0" />
                <div className="min-w-0 text-center sm:text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/95">What you win</p>
                  <p className="mt-2 text-sm font-semibold leading-snug text-white sm:text-base">{WORLD_CUP_BALL_PRIZE_TITLE}</p>
                  <p className="mt-2 text-sm leading-relaxed text-amber-100/75">{WORLD_CUP_BALL_PRIZE_DETAIL}</p>
                </div>
              </div>

              <div id="how-to-enter">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/80">
                  {layout.howToTitle || 'How it works'}
                </p>
                <ol className="mt-4 grid list-none gap-3">
                  {WORLD_CUP_BALL_PUBLIC_STEPS.map((step) => (
                    <li
                      key={step.num}
                      className="ss-rules-step flex gap-3 rounded-xl border-2 border-amber-400/30 bg-gradient-to-br from-amber-950/80 via-[#2a1f05]/70 to-black/40 p-3.5 shadow-[0_3px_0_0_rgba(0,0,0,0.3)] transition hover:border-amber-300/45 sm:gap-4 sm:p-4"
                    >
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black bg-amber-400 text-base font-black leading-none text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.85)] sm:h-10 sm:w-10 sm:text-lg"
                        aria-hidden
                      >
                        {step.num}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-base tracking-tight text-white sm:text-lg">{step.title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-amber-100/70">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-black/25 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/90">Full rules</p>
                <div className="mt-4 space-y-4">
                  {WORLD_CUP_BALL_RULES_SECTIONS.map((section) => (
                    <div key={section.title}>
                      <h2 className="text-sm font-semibold text-amber-100">{section.title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-stone-400">{section.body}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-stone-500">
                  Timing: {WORLD_CUP_BALL_QUESTION_SECONDS} seconds per question; one {WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}
                  -second bonus after the first timeout; disqualified on a second timeout. {WORLD_CUP_BALL_SKILL_NOTICE}
                </p>
              </div>

              <div className="mt-2 flex w-full justify-center sm:mt-3">
                <button
                  type="button"
                  onClick={() => openEntry('worldCupBall')}
                  className="w-full max-w-md rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3.5 text-base font-bold text-stone-950 shadow-lg transition hover:brightness-110"
                  tabIndex={editorMode ? -1 : undefined}
                >
                  {layout.ctaButtonLabel || 'Start the timed quiz'}
                </button>
              </div>
            </div>

            <aside className="mx-auto w-full max-w-[360px] rounded-2xl border border-amber-400/25 bg-black/25 p-5 lg:mx-0 lg:max-w-none lg:sticky lg:top-24 lg:self-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/90">Skill test</p>
              <p className="mt-3 text-lg font-semibold leading-snug text-white">
                {WORLD_CUP_BALL_QUESTION_COUNT} difficult football questions
              </p>
              <p className="mt-3 text-sm leading-relaxed text-amber-200/70">
                Answer every question correctly within the time limits to win the ball immediately.{' '}
                {WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT}. No VPNs. You only share your name, phone, and address if
                you win.
              </p>
              <button
                type="button"
                className="mt-5 w-full rounded-xl border border-amber-400/35 px-4 py-3 text-sm font-bold text-amber-100 hover:bg-amber-950/30"
                onClick={() => openEntry('worldCupBall')}
                tabIndex={editorMode ? -1 : undefined}
              >
                {layout.ctaButtonLabel || 'Start the timed quiz'}
              </button>
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
