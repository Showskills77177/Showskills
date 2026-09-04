import { Link } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_PRIZE_DETAIL,
  WORLD_CUP_BALL_PRIZE_TITLE,
  WORLD_CUP_BALL_QUESTION_COUNT,
} from '../../shared/worldCupBallGiveaway.mjs'
import {
  WORLD_CUP_BALL_PUBLIC_STEPS,
  WORLD_CUP_BALL_TERMS_SECTIONS,
  WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT,
  WORLD_CUP_BALL_GIVEAWAY_PAGE_ID,
  mergeWorldCupBallGiveawayPageLayout,
  defaultWorldCupBallGiveawayPageLayout,
} from '../../shared/worldCupBallGiveawayRules.mjs'
import { usePageLayout } from '../hooks/useSitePages'
import { WorldCupBallPrizeFrame } from '../components/WorldCupBallPrizeFrame'
import { WorldCupBallTimingCallout } from '../components/WorldCupBallTimingCallout'
import { WorldCupBallGiveawayBackdrop } from '../components/WorldCupBallGiveawayBackdrop'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'
import { localizedLayoutText } from '../../shared/i18n/localizedLayout.mjs'
import { useSeoMeta } from '../hooks/useSeoMeta'
import { JsonLd } from '../components/JsonLd'
import { buildFaqPageJsonLd, buildQuizJsonLd } from '../../shared/seoSchema.mjs'
import { SHOWSKILLS_LOTTERY_FAQ_QUESTION, SHOWSKILLS_LOTTERY_FAQ_ANSWER } from '../../shared/sitePositioning.mjs'

const WORLD_CUP_BALL_QUIZ_FAQ = [
  {
    question: SHOWSKILLS_LOTTERY_FAQ_QUESTION,
    answer: SHOWSKILLS_LOTTERY_FAQ_ANSWER,
  },
]

function HostNationsBadge({ t }) {
  return (
    <p className="ss-wc-ball-giveaway-page__hosts inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-amber-300/35 bg-black/45 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-100 backdrop-blur-sm sm:text-[11px]">
      <span className="ss-wc-ball-giveaway-page__hosts-pulse h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
      <span>{t('wcBall.hosts')}</span>
      <span className="text-amber-300/50" aria-hidden>
        ·
      </span>
      <span className="text-amber-200/90">{t('wcBall.hostNations')}</span>
    </p>
  )
}

function StartQuizButton({ onClick, label, editorMode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ss-wc-ball-giveaway-page__cta ss-wc-ball-giveaway-page__cta--primary"
      tabIndex={editorMode ? -1 : undefined}
    >
      {label}
    </button>
  )
}

/** Rules and entry hub for the World Cup Ball Giveaway. */
export default function WorldCupBallGiveawayPage({ layout: layoutProp = null, editorMode = false }) {
  const { openEntry, openTerms } = useEntryFlow()
  const { locale, t } = useSiteLocale()
  const { layout: fetchedLayout } = usePageLayout(WORLD_CUP_BALL_GIVEAWAY_PAGE_ID)
  const layout = mergeWorldCupBallGiveawayPageLayout(layoutProp || fetchedLayout)
  const defaults = defaultWorldCupBallGiveawayPageLayout()
  const ctaLabel =
    localizedLayoutText(locale, t, 'layout.wcBall.ctaButtonLabel', layout.ctaButtonLabel, defaults.ctaButtonLabel) ||
    t('wcBall.startQuiz')
  const localizedSteps = WORLD_CUP_BALL_PUBLIC_STEPS.map((step) => ({
    ...step,
    title: t(`wcBall.step.${step.num}.title`) || step.title,
    detail: t(`wcBall.step.${step.num}.detail`) || step.detail,
  }))
  const localizedTerms = WORLD_CUP_BALL_TERMS_SECTIONS.map((section, i) => ({
    ...section,
    title: t(`wcBall.terms.${i}.title`) || section.title,
    body: t(`wcBall.terms.${i}.body`) || section.body,
  }))
  const atAGlance = [
    t('wcBall.oneAttemptShort', { fallback: WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT }),
    t('wcBall.atAGlance.adRequired', { fallback: 'A short ad video is mandatory before you can start — no skip or bypass' }),
    t('wcBall.atAGlance.adPatience', { fallback: 'Some ads run over a minute — please be patient, this helps fund the rewards' }),
    t('wcBall.atAGlance.free'),
    t('wcBall.atAGlance.noVpn'),
    t('wcBall.atAGlance.delivery'),
  ]

  const handleStart = () => openEntry('worldCupBall')

  useSeoMeta({
    title: `${WORLD_CUP_BALL_GIVEAWAY_LABEL} — Free Football Skill Quiz | ShowSkills`,
    description:
      'Free World Cup Ball skill quiz — no tickets, no lottery. Answer football questions correctly to win outright.',
    path: '/world-cup-ball-giveaway',
  })

  return (
    <main
      className={`ss-wc-ball-giveaway-page relative m-0 overflow-x-hidden p-0 ${
        editorMode ? 'ss-page-editor-preview [&_button:not([data-editor-ui])]:pointer-events-none' : ''
      }`}
    >
      <WorldCupBallGiveawayBackdrop />
      <JsonLd
        data={buildQuizJsonLd({
          name: WORLD_CUP_BALL_GIVEAWAY_LABEL,
          description: 'Free football skill quiz. No tickets, no lottery. Correct answers can win outright.',
          url: '/world-cup-ball-giveaway',
          questionCount: WORLD_CUP_BALL_QUESTION_COUNT,
        })}
      />
      <JsonLd data={buildFaqPageJsonLd(WORLD_CUP_BALL_QUIZ_FAQ)} />

      {/* Hero */}
      <section className="ss-wc-ball-giveaway-page__hero relative">
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(260px,420px)] lg:gap-12">
            <div className="min-w-0 text-left">
              <HostNationsBadge t={t} />

              <p className="mt-5 font-display text-xs font-bold uppercase tracking-[0.32em] text-amber-300/90 sm:text-sm">
                {localizedLayoutText(locale, t, 'layout.wcBall.badge', layout.badge, defaults.badge)}
              </p>

              <h1 className="ss-wc-ball-giveaway-page__title font-display mt-3 text-[clamp(2.5rem,10vw,4.5rem)] uppercase leading-[0.92] tracking-[0.02em] text-amber-100">
                {localizedLayoutText(locale, t, 'layout.wcBall.title', layout.title, defaults.title) ||
                  WORLD_CUP_BALL_GIVEAWAY_LABEL}
              </h1>

              <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-amber-50/88 sm:text-lg">
                {localizedLayoutText(locale, t, 'layout.wcBall.intro', layout.intro, defaults.intro) || t('wcBall.pageIntro')}
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

              <div id="enter-quiz" className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <StartQuizButton onClick={handleStart} label={ctaLabel} editorMode={editorMode} />
                <a
                  href="#how-to-enter"
                  className="ss-wc-ball-giveaway-page__scroll-link text-center text-sm font-semibold text-amber-300/90 underline-offset-4 hover:text-amber-200 hover:underline sm:text-left"
                >
                  How it works ↓
                </a>
              </div>
            </div>

            <div className="ss-wc-ball-giveaway-page__prize-spotlight relative mx-auto w-full max-w-[22rem] lg:max-w-none">
              <div className="ss-wc-ball-giveaway-page__prize-ring" aria-hidden />
              <WorldCupBallPrizeFrame variant="hero" className="relative z-[1] w-full" />
              <p className="relative z-[1] mt-4 text-center text-sm font-semibold text-amber-100/90">
                {WORLD_CUP_BALL_PRIZE_TITLE}
              </p>
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
                <WorldCupBallPrizeFrame
                  variant="thumb"
                  showChips={false}
                  className="mx-auto w-full max-w-[10rem] shrink-0 sm:mx-0"
                />
              </div>

              <div id="how-to-enter">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/85">
                  {localizedLayoutText(locale, t, 'layout.wcBall.howToTitle', layout.howToTitle, defaults.howToTitle) ||
                    t('wcBall.howToWin')}
                </p>
                <ol className="mt-5 grid list-none gap-3">
                  {localizedSteps.map((step) => (
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
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/90">
                  {SHOWSKILLS_LOTTERY_FAQ_QUESTION}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-amber-100/78">{SHOWSKILLS_LOTTERY_FAQ_ANSWER}</p>
              </div>

              <div className="ss-wc-ball-giveaway-page__glass rounded-2xl p-5 sm:p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/90">Full rules</p>
                <div className="mt-5 space-y-5">
                  {localizedTerms.map((section) => (
                    <div key={section.title} className="border-b border-white/6 pb-5 last:border-0 last:pb-0">
                      <h2 className="text-sm font-semibold text-amber-50">{section.title}</h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{section.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  <button
                    type="button"
                    onClick={() => openTerms()}
                    className="text-sm font-semibold text-amber-400/95 underline underline-offset-2 hover:text-amber-300"
                  >
                    Open full site terms
                  </button>
                  <Link
                    to="/faq#world-cup-ball"
                    className="text-sm font-semibold text-amber-400/95 underline underline-offset-2 hover:text-amber-300"
                  >
                    FAQ
                  </Link>
                </div>
              </div>
            </div>

            <aside className="ss-wc-ball-giveaway-page__aside mx-auto w-full max-w-[360px] rounded-2xl p-5 lg:sticky lg:top-24 lg:mx-0 lg:max-w-none lg:self-start lg:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300/90">At a glance</p>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-amber-100/78">
                {atAGlance.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-amber-200/70">
                One salvage question if you miss exactly once. Two wrong answers end the attempt — you still enter that
                month&apos;s draw.
              </p>
              <p className="mt-5 text-center text-xs text-stone-500 lg:text-left">
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
