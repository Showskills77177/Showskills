import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useEntryFlow } from '../entry/entryContext'
import { usePublishedCompetitions } from '../hooks/usePublicCompetition'
import { usePublishedGiveaways } from '../hooks/usePublicGiveaway'
import { usePageLayout } from '../hooks/useSitePages'
import { useMatchedCompetitionCardHeight } from '../hooks/useMatchedCompetitionCardHeight'
import { useShirtGiveawayCompetition } from '../hooks/useShirtGiveawayCompetition'
import { pickCountdownPeriod, DRAW_COMPETITION_SLUG } from '../../shared/competitionPeriods.mjs'
import {
  COMPETITIONS_PAGE_ID,
  mergeCompetitionsPageLayout,
} from '../../shared/sitePageLayout.mjs'
import { CompetitionPublicCard } from '../components/CompetitionPublicCard'
import { GiveawayPublicCard } from '../components/GiveawayPublicCard'
import { LegacyShirtGiveawayCard } from '../components/LegacyShirtGiveawayCard'
import { EditableDragFrame } from '../components/admin/EditableDragFrame'
import { liveOffsetStyle } from '../../shared/layoutOffsets.mjs'

function SectionHeading({ id, children }) {
  return (
    <h2 id={id} className="font-display text-2xl uppercase tracking-[0.08em] text-white sm:text-3xl">
      {children}
    </h2>
  )
}

function legacyCardLayoutKey(card) {
  if (!card || typeof card !== 'object') return ''
  const o = card.offsets || {}
  return [
    card.headlineGapPx ?? 14,
    o.imagery?.y,
    o.meta?.y,
    o.timer?.y,
    o.timer?.scale,
    o.title?.y,
    o.summary?.y,
    o.price?.y,
    o.enter?.y,
  ].join(',')
}

function shirtCardLayoutKey(card) {
  if (!card || typeof card !== 'object') return ''
  const o = card.offsets || {}
  return [
    card.headlineGapPx ?? 12,
    o.imagery?.y,
    o.badge?.y,
    o.title?.y,
    o.prizeLine?.y,
    o.helper?.y,
    o.timer?.y,
    o.timer?.scale,
    o.steps?.y,
    o.enter?.y,
  ].join(',')
}

export default function CompetitionsPage({
  layout: layoutProp,
  editorMode = false,
  selectedBlockId = null,
  onSelectBlock,
  onPatchLayout,
} = {}) {
  const { openEntry } = useEntryFlow()
  const { layout: fetchedLayout, loading: layoutLoading } = usePageLayout(COMPETITIONS_PAGE_ID)
  const layout = mergeCompetitionsPageLayout(layoutProp || fetchedLayout)
  const { competitions, loading: loadingCompetitions } = usePublishedCompetitions()
  const { giveaways, loading: loadingGiveaways } = usePublishedGiveaways()
  const loading = layoutLoading || loadingCompetitions || loadingGiveaways

  const offsets = layout.offsets || {}
  const shirtCardOffset = offsets.shirtCard || { x: 0, y: 0, scale: 1 }
  const paidPrimaryCardOffset = offsets.paidPrimaryCard || { x: 0, y: 0, scale: 1 }
  const legacyBundleCard = layout.legacyBundleCard || {}
  const shirtGiveawayCard = layout.shirtGiveawayCard || {}
  const showPaid = layout.sections.paid?.visible !== false
  const showFree = layout.sections.free?.visible !== false
  const visibleSectionCount = (showPaid ? 1 : 0) + (showFree ? 1 : 0)

  const { competition: shirtCompetition, loading: shirtPeriodLoading } = useShirtGiveawayCompetition()
  const shirtCountdownPeriod = pickCountdownPeriod(shirtCompetition)

  const matchKey = [
    competitions.length,
    giveaways.length,
    loading,
    shirtPeriodLoading,
    shirtCardOffset.scale,
    paidPrimaryCardOffset.scale,
    showPaid,
    showFree,
    editorMode ? 'edit' : 'live',
    legacyCardLayoutKey(legacyBundleCard),
    shirtCardLayoutKey(shirtGiveawayCard),
  ].join('|')
  const { paidCardRef, shirtCardRef } = useMatchedCompetitionCardHeight(matchKey)

  function dragWrap(id, label, offsetKey, node, opts = {}) {
    const pos = offsets?.[offsetKey] || { x: 0, y: 0, scale: 1 }
    if (!editorMode) {
      const style = liveOffsetStyle(pos, {
        cssScaleOnly: opts.cssScaleOnly,
        transformOrigin: 'center top',
        widthOnly: true,
        scale: pos.scale ?? 1,
      })
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
        className={
          opts.className ||
          (opts.cssScaleOnly ? 'flex h-full min-h-0 w-full flex-col' : 'block w-full max-w-full')
        }
        onChange={(patch) => onPatchLayout?.({ offsets: { ...offsets, [offsetKey]: { ...pos, ...patch } } })}
      >
        {node}
      </EditableDragFrame>
    )
  }

  function patchShirtGiveawayCard(patch) {
    onPatchLayout?.({
      shirtGiveawayCard: {
        ...shirtGiveawayCard,
        ...patch,
        offsets: patch.offsets
          ? { ...(shirtGiveawayCard.offsets || {}), ...patch.offsets }
          : shirtGiveawayCard.offsets,
      },
    })
  }

  const shirtCard = (
    <LegacyShirtGiveawayCard
      className="h-full min-h-0"
      onEnter={() => openEntry('kickups')}
      cardScale={shirtCardOffset.scale ?? 1}
      cardLayout={shirtGiveawayCard}
      countdownPeriod={shirtCountdownPeriod}
      countdownPending={shirtPeriodLoading}
      editorMode={editorMode}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
      onPatchCardLayout={patchShirtGiveawayCard}
    />
  )

  function patchLegacyBundleCard(patch) {
    onPatchLayout?.({
      legacyBundleCard: {
        ...legacyBundleCard,
        ...patch,
        offsets: patch.offsets
          ? { ...(legacyBundleCard.offsets || {}), ...patch.offsets }
          : legacyBundleCard.offsets,
      },
    })
  }

  function renderPaidCard(competition, index) {
    const isLegacy = competition.slug === DRAW_COMPETITION_SLUG
    const card = (
      <CompetitionPublicCard
        className="h-full min-h-0"
        competition={competition}
        preview={false}
        editorMode={editorMode && isLegacy}
        cardLayout={isLegacy ? legacyBundleCard : undefined}
        cardScale={isLegacy ? paidPrimaryCardOffset.scale ?? 1 : 1}
        selectedBlockId={selectedBlockId}
        onSelectBlock={onSelectBlock}
        onPatchCardLayout={isLegacy ? patchLegacyBundleCard : undefined}
        onEnter={editorMode ? undefined : () => openEntry('paid', { competitionSlug: competition.slug })}
      />
    )

    const wrapped =
      isLegacy && index === 0
        ? dragWrap('comp_paid_card', 'Legacy Bundle card', 'paidPrimaryCard', card, { cssScaleOnly: true })
        : card

    return (
      <div
        ref={index === 0 ? paidCardRef : undefined}
        className="ss-competition-paid-slot flex h-full min-h-0 w-full flex-col"
      >
        {wrapped}
      </div>
    )
  }

  const paidColumn = (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeading id="paid-competitions-heading">
        {layout.sections.paid?.title || 'Prize draw competitions'}
      </SectionHeading>
      <p className="mt-2 text-sm text-stone-500">{layout.sections.paid?.subtitle}</p>
      <ul className="mt-4 grid list-none gap-6">
        {competitions.map((c, index) => (
          <li key={c.slug} className={index === 0 ? 'ss-competition-paid-primary' : ''}>
            {renderPaidCard(c, index)}
          </li>
        ))}
      </ul>
      {!loading && competitions.length === 0 && layout.emptyPaidMessage ? (
        <p className="mt-6 text-sm text-stone-500">{layout.emptyPaidMessage}</p>
      ) : null}
    </div>
  )

  const freeColumn = (
    <div className="flex min-h-0 flex-1 flex-col" id="free-giveaways">
      <SectionHeading id="free-giveaways-heading">
        {layout.sections.free?.title || 'Free giveaways'}
      </SectionHeading>
      <p className="mt-2 text-sm text-stone-500">{layout.sections.free?.subtitle}</p>
      <ul className="mt-4 grid list-none gap-6">
        <li className="ss-competition-free-primary w-full">
          <div
            ref={shirtCardRef}
            className="ss-competition-shirt-slot flex h-full min-h-0 w-full flex-col [&_[data-editor-drag]]:flex [&_[data-editor-drag]]:h-full [&_[data-editor-drag]]:min-h-0 [&_[data-editor-drag]]:w-full [&_[data-editor-drag]]:flex-col"
          >
            {dragWrap('comp_shirt', 'Shirt giveaway card', 'shirtCard', shirtCard, { cssScaleOnly: true })}
          </div>
        </li>
        {giveaways.map((g) => (
          <li key={g.slug}>
            <GiveawayPublicCard giveaway={g} onEnter={() => openEntry('paid', { competitionSlug: g.slug })} />
          </li>
        ))}
      </ul>
      {!loading && giveaways.length === 0 && layout.emptyFreeMessage ? (
        <p className="mt-6 text-sm text-stone-500">{layout.emptyFreeMessage}</p>
      ) : null}
    </div>
  )

  const sectionBlocks = {
    paid: showPaid
      ? { key: 'comp_paid', label: 'Prize draws column', offsetKey: 'paid', node: paidColumn }
      : null,
    free: showFree
      ? { key: 'comp_free', label: 'Free giveaways column', offsetKey: 'free', node: freeColumn }
      : null,
  }

  const orderedSections = (layout.sectionOrder || ['paid', 'free'])
    .map((id) => (sectionBlocks[id] ? { id, ...sectionBlocks[id] } : null))
    .filter(Boolean)

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div data-editor-align-group data-editor-center-root>
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
        </div>

        {loading ? (
          <p className="mt-10 text-sm text-stone-500" role="status">
            Loading competitions…
          </p>
        ) : null}

        {visibleSectionCount > 0 ? (
          <div
            className={`ss-competitions-columns grid gap-8 ${loading ? 'mt-6' : 'mt-12'} ${
              visibleSectionCount > 1
                ? 'ss-competitions-columns--paired lg:grid-cols-2 lg:items-stretch'
                : 'max-w-xl'
            }`}
          >
            {orderedSections.map((section) => (
              <div key={section.id} className="min-w-0">
                {dragWrap(section.key, section.label, section.offsetKey, section.node)}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-sm text-stone-500">Both sections are hidden — enable one in the page editor.</p>
        )}
      </div>
    </main>
  )
}
