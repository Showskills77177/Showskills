import { Link } from 'react-router-dom'
import { ExternalLink, Shirt, Trophy } from 'lucide-react'
import AdminCompetitionCatalogPage from './CompetitionsAdminPage'
import ShirtGiveawayPeriodsAdmin from '../../components/admin/ShirtGiveawayPeriodsAdmin'
import { SHIRT_GIVEAWAY_PAGE_ID } from '../../../shared/sitePageLayout.mjs'
import {
  WORLD_CUP_BALL_ADMIN_HELP,
  WORLD_CUP_BALL_ADMIN_ROUTES,
} from '../../../shared/adminListCopy.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL, WORLD_CUP_BALL_GIVEAWAY_PATH } from '../../../shared/worldCupBallGiveaway.mjs'

export default function GiveawaysAdminPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-950/50 to-black/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-950/40 text-amber-300">
              <Trophy className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">Skill giveaway</p>
              <h2 className="mt-1 text-lg font-semibold text-stone-100">{WORLD_CUP_BALL_GIVEAWAY_LABEL}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-400">{WORLD_CUP_BALL_ADMIN_HELP.hub}</p>
              <ul className="mt-3 space-y-1 text-xs text-stone-500">
                <li>
                  <strong className="text-stone-400">Monthly draw (failed quizzes)</strong> →{' '}
                  <Link to={WORLD_CUP_BALL_ADMIN_ROUTES.monthlyDraw} className="text-amber-400/90 underline">
                    WC Ball draw
                  </Link>
                </li>
                <li>
                  <strong className="text-stone-400">Winner delivery details</strong> →{' '}
                  <Link to={WORLD_CUP_BALL_ADMIN_ROUTES.winners} className="text-amber-400/90 underline">
                    Giveaway entries
                  </Link>{' '}
                  (filter: {WORLD_CUP_BALL_GIVEAWAY_LABEL})
                </li>
                <li>
                  <strong className="text-stone-400">Quiz starts / wins / form saves</strong> →{' '}
                  <Link to={WORLD_CUP_BALL_ADMIN_ROUTES.entryLog} className="text-amber-400/90 underline">
                    Entry log
                  </Link>
                </li>
                <li>
                  <strong className="text-stone-400">Winner emails</strong> →{' '}
                  <Link to={WORLD_CUP_BALL_ADMIN_ROUTES.testEmail} className="text-amber-400/90 underline">
                    Test email
                  </Link>{' '}
                  (group: {WORLD_CUP_BALL_GIVEAWAY_LABEL})
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={WORLD_CUP_BALL_ADMIN_ROUTES.monthlyDraw}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-950/40"
            >
              Monthly draw
            </Link>
            <Link
              to={WORLD_CUP_BALL_ADMIN_ROUTES.winners}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-500"
            >
              View winners
            </Link>
            <Link
              to={WORLD_CUP_BALL_ADMIN_ROUTES.entryLog}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
            >
              Entry log
            </Link>
            <Link
              to={WORLD_CUP_BALL_GIVEAWAY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-400 hover:bg-white/5"
            >
              Live rules page
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-lime-400/25 bg-gradient-to-br from-emerald-950/50 to-black/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-400/30 bg-lime-950/40 text-lime-300">
              <Shirt className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-300/90">Legacy giveaway</p>
              <h2 className="mt-1 text-lg font-semibold text-stone-100">Free Ronaldo shirt giveaway</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-400">
                Direct sign-ups and automatic consolation rows from wrong Legacy quiz answers. Edit the public page in
                the site editor, or review entries in Giveaway entries (shirt filter).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/admin/editor?page=${SHIRT_GIVEAWAY_PAGE_ID}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-500"
            >
              Edit giveaway page
            </Link>
            <Link
              to="/admin/submissions?competition=ronaldo_shirt_giveaway"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
            >
              View entries
            </Link>
            <Link
              to="/archive/ronaldo-shirt-giveaway"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-400 hover:bg-white/5"
            >
              Live page
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <ShirtGiveawayPeriodsAdmin />

      <AdminCompetitionCatalogPage catalogKind="giveaway" />
    </div>
  )
}
