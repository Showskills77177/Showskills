import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useSeoMeta } from '../hooks/useSeoMeta'
import { JsonLd } from '../components/JsonLd'
import { buildFaqPageJsonLd } from '../../shared/seoSchema.mjs'
import {
  SHOWSKILLS_POSITIONING_STATEMENT,
  SHOWSKILLS_LOTTERY_FAQ_QUESTION,
  SHOWSKILLS_LOTTERY_FAQ_ANSWER,
} from '../../shared/sitePositioning.mjs'

const STEPS = [
  {
    title: '1. Pick a free quiz',
    body: 'Choose a football skill quiz, like the World Cup Ball quiz. No purchase, no ticket, no sign-up fee.',
  },
  {
    title: '2. Answer the questions',
    body: 'Answer timed football questions. Some quizzes let you make a couple of mistakes and keep going.',
  },
  {
    title: '3. Correct answers can qualify you for a giveaway',
    body: 'Get the questions right and you can qualify for a free giveaway — no lottery, no random ticket draw involved in the quiz itself.',
  },
  {
    title: '4. Please be patient with the short ad',
    body: 'Some quizzes ask you to watch a short ad first (occasionally over a minute). This funds the free prizes we give away — thank you for your patience.',
  },
]

const HOW_IT_WORKS_FAQ = [
  {
    question: SHOWSKILLS_LOTTERY_FAQ_QUESTION,
    answer: SHOWSKILLS_LOTTERY_FAQ_ANSWER,
  },
  {
    question: 'Do I have to pay to play a quiz?',
    answer: 'No. ShowSkills skill quizzes are free to play. There is no ticket price and no paid entry required.',
  },
  {
    question: 'Why do I sometimes have to watch an ad first?',
    answer:
      'A short ad (sometimes over a minute) helps fund the free prizes we give away. We ask for your patience — the quiz starts as soon as the ad finishes.',
  },
]

export default function HowItWorksPage() {
  useSeoMeta({
    title: 'How It Works — Free Football Skill Quizzes | ShowSkills',
    description:
      'How ShowSkills free football skill quizzes work: answer questions, no tickets, no lottery. Correct answers can qualify you for a free giveaway.',
    path: '/how-it-works',
  })

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <JsonLd data={buildFaqPageJsonLd(HOW_IT_WORKS_FAQ)} />
      <div className="relative z-[1] mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">How it works</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">{SHOWSKILLS_POSITIONING_STATEMENT}</p>

        <ol className="mt-10 list-none space-y-5">
          {STEPS.map((step) => (
            <li key={step.title} className="rounded-2xl border border-white/[0.08] bg-[#071512]/70 p-5 sm:p-6">
              <h2 className="text-base font-semibold text-stone-100 sm:text-lg">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-400 sm:text-[15px]">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#071512]/70 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300/80">
            {SHOWSKILLS_LOTTERY_FAQ_QUESTION}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">{SHOWSKILLS_LOTTERY_FAQ_ANSWER}</p>
        </div>

        <p className="mt-8 text-sm text-stone-500">
          Ready to play?{' '}
          <Link to="/quizzes" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
            See all free quizzes
          </Link>{' '}
          or read the full{' '}
          <Link to="/faq" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
            FAQ
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
