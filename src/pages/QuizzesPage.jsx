import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useSeoMeta } from '../hooks/useSeoMeta'
import { JsonLd } from '../components/JsonLd'
import { buildFaqPageJsonLd } from '../../shared/seoSchema.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL, WORLD_CUP_BALL_QUESTION_COUNT } from '../../shared/worldCupBallGiveaway.mjs'
import {
  SHOWSKILLS_POSITIONING_STATEMENT,
  SHOWSKILLS_LOTTERY_FAQ_QUESTION,
  SHOWSKILLS_LOTTERY_FAQ_ANSWER,
} from '../../shared/sitePositioning.mjs'

const QUIZZES_FAQ = [
  {
    question: SHOWSKILLS_LOTTERY_FAQ_QUESTION,
    answer: SHOWSKILLS_LOTTERY_FAQ_ANSWER,
  },
]

function QuizCard({ title, description, questionCount, to, badge }) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-white/[0.08] bg-[#071512]/70 p-5 transition hover:border-emerald-500/30 hover:bg-[#071512]/90 sm:p-6"
    >
      {badge ? (
        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
          {badge}
        </span>
      ) : null}
      <h2 className="mt-3 font-display text-xl uppercase tracking-[0.04em] text-white sm:text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-400">{description}</p>
      {questionCount ? (
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
          {questionCount} questions · free to play
        </p>
      ) : null}
    </Link>
  )
}

export default function QuizzesPage() {
  useSeoMeta({
    title: 'Free Football Skill Quizzes | ShowSkills',
    description:
      'Play free hard football skill quizzes on ShowSkills. No tickets, no lottery. Correct answers can qualify you for a free giveaway.',
    path: '/quizzes',
  })

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <JsonLd data={buildFaqPageJsonLd(QUIZZES_FAQ)} />
      <div className="relative z-[1] mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">
          Free football skill quizzes
        </h1>
        <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">{SHOWSKILLS_POSITIONING_STATEMENT}</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <QuizCard
            title={WORLD_CUP_BALL_GIVEAWAY_LABEL}
            description="Answer football questions correctly to win an official-style World Cup football outright — or a $30 cash prize if you win from outside the UK."
            questionCount={WORLD_CUP_BALL_QUESTION_COUNT}
            to="/world-cup-ball-giveaway"
            badge="Free skill quiz"
          />
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#071512]/70 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300/80">
            {SHOWSKILLS_LOTTERY_FAQ_QUESTION}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">{SHOWSKILLS_LOTTERY_FAQ_ANSWER}</p>
        </div>

        <p className="mt-8 text-sm text-stone-500">
          New quizzes are added regularly. Read{' '}
          <Link to="/how-it-works" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
            how it works
          </Link>{' '}
          or check{' '}
          <Link to="/giveaways" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
            current giveaways
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
