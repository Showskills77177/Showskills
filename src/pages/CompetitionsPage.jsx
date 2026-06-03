import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useEntryFlow } from '../entry/entryContext'
import { usePublishedCompetitions } from '../hooks/usePublicCompetition'
import { usePublishedGiveaways } from '../hooks/usePublicGiveaway'
import { usePageLayout } from '../hooks/useSitePages'
import { useMatchedCompetitionCardHeight } from '../hooks/useMatchedCompetitionCardHeight'
import { COMPETITIONS_PAGE_ID } from '../../shared/sitePageLayout.mjs'
import { CompetitionPublicCard } from '../components/CompetitionPublicCard'
import { GiveawayPublicCard } from '../components/GiveawayPublicCard'
import { LegacyShirtGiveawayCard } from '../components/LegacyShirtGiveawayCard'
import { EditableDragFrame } from '../components/admin/EditableDragFrame'
import { offsetStyle } from '../../shared/layoutOffsets.mjs'

function SectionHeading({ id, children }) {
  return (
    <h2 id={id} className="font-display text-2xl uppercase tracking-[0.08em] text-white sm:text-3xl">
      {children}
    </h2>
  )
}

export default function CompetitionsPage({
  layout: layoutProp,
  editorMode = false,
  selectedBlockId = null,
  onSelectBlock,
  onPatchLayout,
} = {}) {
  const { openEntry } = useEntryFlow()
  const { layout: fetchedLayout } = usePageLayout(COMPETITIONS_PAGE_ID)
  const layout = layoutProp || fetchedLayout
  const { competitions, loading: loadingCompetitions } = usePublishedCompetitions()
  const { giveaways, loading: loadingGiveaways } = usePublishedGiveaways()
  const loading = loadingCompetitions || loadingGiveaways

  const offsets = layout?.offsets || {}
  const shirtCardOffset = offsets.shirtCard || { x: 0, y: 0, scale: 1.1 }
  const showPaid = layout.sections.paid?.visible !== false
  const showFree = layout.sections.free?.visible !== false

  const matchKey = `${competitions.length}-${giveaways.length}-${loading}-${shirtCardOffset.scale}-${showPaid}-${showFree}`
  const { paidCardRef, shirtCardRef } = useMatchedCompetitionCardHeight(matchKey)

  function dragWrap(id, label, offsetKey, node, opts = {}) {
    const pos = offsets?.[offsetKey] || { x: 0, y: 0, scale: 1 }
    if (!editorMode) {
      if (opts.cssScaleOnly) {
        if (!pos.x && !pos.y) return node
        return (
          <div
            style={{
              transform: `translate(${pos.x || 0}px, ${pos.y || 0}px)`,
              transformOrigin: 'center top',
            }}
          >
            {node}
          </div>
        )
      }
      const style = offsetStyle(pos, { scale: pos.scale ?? 1, widthOnly: true })
      if (!style) return node
      return <div style={style}>{node}</div>
    }
    return (
      <EditableDragFrame
        id={id}
        label={label}
        x={pos.x}
        y={pos.y}
        scale={opts.cssScaleOnly ? 1 : (pos.scale ?? 1)}
        selected={selectedBlockId === id}
        onSelect={onSelectBlock}
        cssScaleOnly={opts.cssScaleOnly}
        onChange={(patch) => onPatchLayout?.({ offsets: { ...offsets, [offsetKey]: { ...pos, ...patch } } })}
      >
        {node}
      </EditableDragFrame>
    )
  }

  const shirtCard = (
    <LegacyShirtGiveawayCard
      ref={shirtCardRef}
      onEnter={() => openEntry('kickups')}
      cardScale={shirtCardOffset.scale ?? 1.1}
    />
  )

  const paidColumn = (
    <div className="flex min-w-0 flex-col">
      <SectionHeading id="paid-competitions-heading">
        {layout.sections.paid?.title || 'Prize draw competitions'}
      </SectionHeading>
      <p className="mt-2 text-sm text-stone-500">{layout.sections.paid?.subtitle}</p>
      <ul className="mt-6 grid list-none gap-6">
        {competitions.map((c, index) => (
          <li key={c.slug} className={index === 0 ? 'ss-competition-paid-primary' : ''}>
            <div ref={index === 0 ? paidCardRef : undefined} className="ss-competition-paid-slot flex h-full min-h-0 w-full flex-col">
              <CompetitionPublicCard
                className="h-full min-h-0"
                competition={c}
                onEnter={() => openEntry('paid', { competitionSlug: c.slug })}
              />
            </div>
          </li>
        ))}
      </ul>
      {!loading && competitions.length === 0 ? (
        <p className="mt-6 text-sm text-stone-500">
          No extra paid prize draws published yet — the Ronaldo Legacy Bundle is on the homepage.
        </p>
      ) : null}
    </div>
  )

  const freeColumn = (
    <div className="flex min-w-0 flex-col" id="free-giveaways">
      <SectionHeading id="free-giveaways-heading">{layout.sections.free?.title || 'Free giveaways'}</SectionHeading>
      <p className="mt-2 text-sm text-stone-500">{layout.sections.free?.subtitle}</p>
      <ul className="mt-6 grid list-none gap-6">
        <li className="ss-competition-free-primary w-full">
          <div className="ss-competition-shirt-slot w-full [&_[data-editor-drag]]:h-full [&_[data-editor-drag]]:w-full">
            {dragWrap('comp_shirt', 'Shirt giveaway card', 'shirtCard', shirtCard, { cssScaleOnly: true })}
          </div>
        </li>
        {giveaways.map((g) => (
          <li key={g.slug}>
            <GiveawayPublicCard giveaway={g} onEnter={() => openEntry('paid', { competitionSlug: g.slug })} />
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {dragWrap(
          'comp_title',
          'Page title',
          'title',
          <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">{layout.title}</h1>,
        )}
        {dragWrap(
          'comp_intro',
          'Intro',
          'intro',
          <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">{layout.intro}</p>,
        )}
        {dragWrap(
          'comp_links',
          'Links row',
          'links',
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
            {layout.showFaqLink !== false ? (
              <Link
                to="/faq"
                className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300"
                onClick={editorMode ? (e) => e.preventDefault() : undefined}
              >
                {layout.faqLinkLabel || 'Common questions (FAQ)'}
              </Link>
            ) : null}
            {layout.showJumpLink !== false && showFree ? (
              <a
                href="#free-giveaways"
                className="font-semibold text-lime-400/90 underline decoration-lime-700/50 underline-offset-2 hover:text-lime-300"
                onClick={editorMode ? (e) => e.preventDefault() : undefined}
              >
                {layout.jumpLinkLabel || 'Jump to free giveaways'}
              </a>
            ) : null}
          </p>,
        )}

        {loading ? (
          <p className="mt-10 text-sm text-stone-500" role="status">
            Loading competitions…
          </p>
        ) : null}

        <div
          className={`ss-competitions-columns grid gap-8 ${loading ? 'mt-6' : 'mt-12'} ${
            showPaid && showFree ? 'lg:grid-cols-2 lg:items-start' : 'max-w-xl'
          }`}
        >
          {showPaid ? <div className="min-w-0">{dragWrap('comp_paid', 'Prize draws', 'paid', paidColumn)}</div> : null}
          {showFree ? <div className="min-w-0">{dragWrap('comp_free', 'Free giveaways', 'free', freeColumn)}</div> : null}
        </div>
      </div>
    </main>
  )
}
