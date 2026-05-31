import { useState } from 'react'
import { ModalPortal } from '../ModalPortal'
import { CompetitionPublicCard } from '../CompetitionPublicCard'
import { HomeFeaturedPromotion } from '../HomeFeaturedPromotion'
import { PhotoPageBackdrop } from '../PhotoPageBackdrop'

function buildPreviewModel(draft) {
  if (!draft) return null
  const open =
    draft.periods?.find((p) => p.status === 'open') ||
    draft.periods?.[0] ||
    null
  const activeBundles = (draft.bundles || []).filter((b) => b.active !== false)
  const minBundlePence = activeBundles.length
    ? Math.min(...activeBundles.map((b) => b.totalPence))
    : null
  return {
    slug: draft.slug,
    title: draft.title,
    summary: draft.summary,
    heroImageUrl: draft.heroImageUrl,
    galleryUrls: draft.galleryUrls || [],
    featuredOnHomepage: draft.featuredOnHomepage,
    allowPaidEntry: draft.allowPaidEntry,
    allowFreeOnline: draft.allowFreeOnline,
    allowPostalEntry: draft.allowPostalEntry,
    postalCompetitionName: draft.postalCompetitionName,
    status: draft.status,
    bundles: activeBundles,
    minBundlePence,
    openPeriod: open
      ? {
          entryOpensAt: open.entryOpensAt,
          entryClosesAt: open.entryClosesAt,
          status: open.status,
        }
      : null,
  }
}

/**
 * @param {{ draft: object | null, open: boolean, onClose: () => void }} props
 */
export function CompetitionSitePreviewModal({ draft, open, onClose }) {
  const [tab, setTab] = useState('competitions')
  const model = buildPreviewModel(draft)

  if (!open || !model) return null

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-8">
        <div className="relative w-full max-w-4xl rounded-xl border border-white/15 bg-stone-950 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-100">Site preview</h2>
              <p className="text-xs text-stone-500">
                How visitors see this competition — like the test email preview panel.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-stone-300 hover:bg-white/5"
            >
              Close
            </button>
          </div>

          <div className="flex gap-1 border-b border-white/10 px-4 pt-2">
            <PreviewTab active={tab === 'competitions'} onClick={() => setTab('competitions')}>
              Competitions page card
            </PreviewTab>
            {model.featuredOnHomepage ? (
              <PreviewTab active={tab === 'homepage'} onClick={() => setTab('homepage')}>
                Homepage live promotion
              </PreviewTab>
            ) : (
              <span className="px-3 py-2 text-xs text-stone-600">
                Homepage tab appears when “Feature on homepage” is checked
              </span>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4">
            {tab === 'competitions' ? (
              <div className="relative rounded-xl border border-white/10 bg-[#0a0f0d] p-4">
                <PhotoPageBackdrop />
                <div className="relative z-[1] mx-auto max-w-lg">
                  <p className="mb-4 text-xs uppercase tracking-wider text-stone-500">/competitions</p>
                  <CompetitionPublicCard competition={model} preview draft={model.status !== 'published'} />
                </div>
              </div>
            ) : (
              <HomeFeaturedPromotion competition={model} preview />
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-3 text-xs text-stone-500">
            {model.status === 'published'
              ? 'Published — this competition appears on the public Competitions page automatically.'
              : 'Set status to Published and open a competition period before entries work on the live site.'}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

function PreviewTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-lg px-3 py-2 text-sm ${
        active
          ? 'border border-b-0 border-white/15 bg-stone-900/80 font-semibold text-teal-100'
          : 'text-stone-500 hover:text-stone-300'
      }`}
    >
      {children}
    </button>
  )
}
