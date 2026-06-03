import { Link } from 'react-router-dom'
import { ExternalLink, Shirt } from 'lucide-react'
import AdminCompetitionCatalogPage from './CompetitionsAdminPage'
import ShirtGiveawayPeriodsAdmin from '../../components/admin/ShirtGiveawayPeriodsAdmin'
import { SHIRT_GIVEAWAY_PAGE_ID } from '../../../shared/sitePageLayout.mjs'

export default function GiveawaysAdminPage() {
  return (
    <div className="space-y-6">
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
                This is the main free shirt promotion on the site. Edit the public page copy and prize image in the page
                editor, or review sign-ups in Shirt giveaway submissions.
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
              to="/admin/submissions"
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
