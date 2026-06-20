import { Link } from 'react-router-dom'
import { useMemo } from 'react'
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
import { WorldCupBallGiveawayCard } from '../components/WorldCupBallGiveawayCard'
import { EditableDragFrame } from '../components/admin/EditableDragFrame'
import { resolveLayoutOffsets, EDITOR_VIEWPORT_MOBILE } from '../../shared/layoutOffsets.mjs'
import { resolveLegacyBundlePublicCompetition } from '../../shared/legacyBundlePublic.mjs'
import {
  IPHONE_17_PRO_COMPETITION_SLUG,
} from '../../shared/iphone17ProCompetition.mjs'
import { resolveIphone17ProPublicCompetition } from '../../shared/iphone17ProPublic.mjs'
import { useLayoutViewport } from '../hooks/useLayoutViewport'

function SectionHeading({ id, children }) {
  return (
    <h2 id={id} className="font-display text-[1.625rem] uppercase tracking-[0.08em] text-white sm:text-3xl">
      {children}
    </h2>
  )
}

function legacyCardLayoutKey(card, viewport) {
  if (!card || typeof card !== 'object') return ''
  const o = resolveLayoutOffsets(card.offsets || {}, card.mobileOffsets || {}, viewport)
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

function shirtCardLayoutKey(card, viewport) {
  if (!card || typeof card !== 'object') return ''
  const o = resolveLayoutOffsets(card.offsets || {}, card.mobileOffsets || {}, viewport)
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
  editorViewport = 'desktop',
  selectedBlockId = null,
  onSelectBlock,
  onPatchLayout,
} = {}) {
  const { openEntry } = useEntryFlow()
  const { layout: fetchedLayout, loading: layoutLoading } = usePageLayout(COMPETITIONS_PAGE_ID)
  const layout = mergeCompetitionsPageLayout(layoutProp || fetchedLayout)
  const layoutViewport = useLayoutViewport({ editorMode, editorViewport })
  const { competitions, loading: loadingCompetitions } = usePublishedCompetitions()
  const { giveaways, loading: loadingGiveaways } = usePublishedGiveaways()
  const paidCompetitions = useMemo(() => {
    const legacy = resolveLegacyBundlePublicCompetition({ listItems: competitions })
    const iphone = resolveIphone17ProPublicCompetition({ listItems: competitions })
    const extras = competitions.filter(
      (c) => c.slug !== DRAW_COMPETITION_SLUG && c.slug !== IPHONE_17_PRO_COMPETITION_SLUG,
    )
    return [legacy, iphone, ...extras]
  }, [competitions])
  const loading = layoutLoading || loadingCompetitions || loadingGiveaways

  const desktopOffsets = layout.offsets || {}
  const pageMobileOffsets = layout.mobileOffsets || {}
  const offsets = resolveLayoutOffsets(desktopOffsets, pageMobileOffsets, layoutViewport)
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
    paidCompetitions.length,
    giveaways.length,
    loading,
    shirtPeriodLoading,
    shirtCardOffset.scale,
    paidPrimaryCardOffset.scale,
    showPaid,
    showFree,
    editorMode ? 'edit' : 'live',
    layoutViewport,
    legacyCardLayoutKey(legacyBundleCard, layoutViewport),
    shirtCardLayoutKey(shirtGiveawayCard, layoutViewport),
  ].join('|')
  const { paidCardRef, shirtCardRef } = useMatchedCompetitionCardHeight(matchKey)

  function patchPageOffset(offsetKey, pos, patch) {
    const next = { ...pos, ...patch }
    if (layoutViewport === EDITOR_VIEWPORT_MOBILE) {
      onPatchLayout?.({ mobileOffsets: { ...pageMobileOffsets, [offsetKey]: next } })
      return
    }
    onPatchLayout?.({ offsets: { ...desktopOffsets, [offsetKey]: next } })
  }

  function dragWrap(id, label, offsetKey, node, opts = {}) {
    if (!editorMode) return node
    const pos = offsets?.[offsetKey] || { x: 0, y: 0, scale: 1 }
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
        onChange={(patch) => patchPageOffset(offsetKey, pos, patch)}
      >
        {node}
      </EditableDragFrame>
    )
  }

  function patchCardLayout(card, patch) {
    const { offsets: offsetPatch, ...rest } = patch
    const next = { ...card, ...rest }
    if (offsetPatch) {
      if (layoutViewport === EDITOR_VIEWPORT_MOBILE) {
        next.mobileOffsets = { ...(card.mobileOffsets || {}), ...offsetPatch }
      } else {
        next.offsets = { ...(card.offsets || {}), ...offsetPatch }
      }
    }
    return next
  }

  function patchShirtGiveawayCard(patch) {
    onPatchLayout?.({
      shirtGiveawayCard: patchCardLayout(shirtGiveawayCard, patch),
    })
  }

  const shirtCard = (
    <LegacyShirtGiveawayCard
      className="w-full"
      onEnter={() => openEntry('kickups')}
      cardScale={shirtCardOffset.scale ?? 1}
      cardLayout={shirtGiveawayCard}
      countdownPeriod={shirtCountdownPeriod}
      countdownPending={!shirtCountdownPeriod && shirtPeriodLoading}
      editorMode={editorMode}
      layoutViewport={layoutViewport}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
      onPatchCardLayout={patchShirtGiveawayCard}
    />
  )

  function patchLegacyBundleCard(patch) {
    onPatchLayout?.({
      legacyBundleCard: patchCardLayout(legacyBundleCard, patch),
    })
  }

  function renderPaidCard(competition, index) {
    const isLegacy = competition.slug === DRAW_COMPETITION_SLUG
    const card = (
      <CompetitionPublicCard
        className="w-full"
        competition={competition}
        preview={false}
        editorMode={editorMode && isLegacy}
        layoutViewport={layoutViewport}
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
        ? dragWrap('comp_paid_card', 'Signed Legacy Bundle card', 'paidPrimaryCard', card, { cssScaleOnly: true })
        : card

    return (
      <div
        ref={index === 0 ? paidCardRef : undefined}
        className="ss-competition-paid-slot w-full"
      >
        {wrapped}
      </div>
    )
  }

  const paidColumn = (
    <div className="min-w-0">
      <SectionHeading id="paid-competitions-heading">
        {layout.sections.paid?.title || 'Prize draw competitions'}
      </SectionHeading>
      <p className="mt-2 text-base leading-relaxed text-stone-500 md:text-sm">{layout.sections.paid?.subtitle}</p>
      <ul className="ss-competitions-paid-list mt-4 flex list-none flex-col">
        {paidCompetitions.map((c, index) => (
          <li
            key={c.slug}
            className={index === 0 ? 'ss-competition-paid-primary' : 'ss-competition-paid-follow'}
          >
            {renderPaidCard(c, index)}
          </li>
        ))}
      </ul>
    </div>
  )

  const freeColumn = (
    <div className="min-w-0" id="free-giveaways">
      <SectionHeading id="free-giveaways-heading">
        {layout.sections.free?.title || 'Free giveaways'}
      </SectionHeading>
      <p className="mt-2 text-base leading-relaxed text-stone-500 md:text-sm">{layout.sections.free?.subtitle}</p>
      <ul className="mt-4 grid list-none gap-6">
        <li className="ss-competition-free-primary w-full">
          <div
            ref={shirtCardRef}
            className="ss-competition-shirt-slot w-full [&_[data-editor-drag]]:block [&_[data-editor-drag]]:w-full"
          >
            {dragWrap('comp_shirt', 'Shirt giveaway card', 'shirtCard', shirtCard, { cssScaleOnly: true })}
          </div>
        </li>
        <li className="ss-competition-free-wc-ball w-full">
          <WorldCupBallGiveawayCard onEnter={() => openEntry('worldCupBall')} />
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
            <h1 className="font-display text-[2.125rem] uppercase tracking-[0.08em] text-white sm:text-5xl">{layout.title}</h1>,
          )}
          {dragWrap(
            'comp_intro',
            'Intro',
            'intro',
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-400 sm:text-lg">{layout.intro}</p>,
          )}
          {dragWrap(
            'comp_links',
            'Links row',
            'links',
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-stone-500 md:text-sm">
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
                ? 'ss-competitions-columns--paired md:grid-cols-2 md:items-start'
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
