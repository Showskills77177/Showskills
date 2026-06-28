import { Link } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'
import { useMatchedPanelHeight } from '../hooks/useMatchedPanelHeight'
import kickupsHeroBg from '../assets/kickups-hero-bg.png'
import competitionsPageBg from '../assets/competitions-page-bg.png'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import { IphonePrizePhoto } from './IphonePrizePhoto'
import { GoldCasePrizePhoto } from '../components/GoldCasePrizePhoto'
import { BUNDLE_OFFER_ITEMS } from '../competitionData'
import { GlowingFootballIcon, TicketBundlePrice } from '../components/siteChrome'
import { CompetitionCountdown } from '../components/CompetitionCountdown'
import { useFeaturedHomepageCompetition } from '../hooks/useFeaturedHomepageCompetition'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { useHomepageLayout } from '../hooks/useHomepageLayout'
import { usePublicWinners } from '../hooks/usePublicWinners'
import { HomeWinnersPanel } from '../components/HomeWinnersPanel'
import { HomeCompetitionsHub } from '../components/HomeCompetitionsHub'
import { HomeIphone17ProPanel } from '../components/HomeIphone17ProPanel'
import { HomeWorldCupBallPanel } from '../components/HomeWorldCupBallPanel'
import { LegacyBundleImageryDisclaimer } from '../components/LegacyBundleImageryDisclaimer'
import { LegacyBundleImageryCaption } from '../components/LegacyBundleImageryCaption'
import { LegacyBundlePosterTitle } from '../components/LegacyBundlePosterTitle'
import { EditableSectionOverlay } from '../components/admin/EditableSectionOverlay'
import { EditableDragFrame } from '../components/admin/EditableDragFrame'
import { mergePrizeImages } from '../../shared/homepageLayout.mjs'
import { liveOffsetStyle, resolveLayoutOffsets, EDITOR_VIEWPORT_MOBILE } from '../../shared/layoutOffsets.mjs'
import { LiveLayoutOffset } from './LiveLayoutOffset'
import { useLayoutViewport } from '../hooks/useLayoutViewport'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'
import { DRAW_COMPETITION_SLUG, pickCountdownPeriod } from '../../shared/competitionPeriods.mjs'
import { IPHONE_17_PRO_COMPETITION_SLUG } from '../../shared/iphone17ProCompetition.mjs'
import {
  HOMEPAGE_HERO_BACKGROUNDS,
  HOMEPAGE_BLOCK_IDS,
  isHomeBlockVisible,
  mergeHomepageLayout,
} from '../../shared/homepageLayout.mjs'
import { HOMEPAGE_BLOCK_LABELS } from '../../shared/sitePageLayout.mjs'

const HERO_INNER_BLOCK_IDS = new Set([
  'promo_strip',
  'hero_intro',
  'hero_prizes',
  'hero_details',
  'ticket_bundles',
  'world_cup_ball_panel',
])

function buildHomeSectionSequence(blockOrder) {
  const seq = []
  let heroAdded = false
  for (const id of blockOrder) {
    if (HERO_INNER_BLOCK_IDS.has(id)) {
      if (!heroAdded) {
        seq.push('hero')
        heroAdded = true
      }
    } else if (id === 'iphone_17_pro_panel') {
      seq.push('iphone_17_pro_panel')
    } else if (id === 'competitions_hub') {
      seq.push('competitions_hub')
    } else if (id === 'winners_panel') {
      seq.push('winners_panel')
    }
  }
  if (!heroAdded) seq.unshift('hero')
  return seq
}

function HomeEditorHiddenSection({ label, hint }) {
  return (
    <section className="border-t border-dashed border-white/10 bg-stone-950/40 py-14 sm:py-16">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-600">{label}</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">{hint}</p>
      </div>
    </section>
  )
}

const LEGACY_BUNDLE_SPECS = [
  {
    label: 'iPhone 17 Pro Max',
    body: 'Unlocked, 6.9-inch display, 512GB model. Estimated retail value £1,399.',
  },
  {
    label: 'Colour substitution',
    body: 'If the shown colour is unavailable, an equivalent colour such as black or another available finish may be supplied.',
  },
  {
    label: '24K gold case',
    body: 'Premium gold-style case for the iPhone 17 Pro Max, included as part of the prize stack.',
  },
  {
    label: 'Museum signed football',
    body: 'Certified Ronaldo museum-style signed football, presented as a collector item with the bundle.',
  },
]

const HERO_BG = {
  [HOMEPAGE_HERO_BACKGROUNDS.kickups]: kickupsHeroBg,
  [HOMEPAGE_HERO_BACKGROUNDS.competitions]: competitionsPageBg,
}

function HeroHeadline({ text, highlight }) {
  if (!highlight || !text.includes(highlight)) return text
  const idx = text.indexOf(highlight)
  return (
    <>
      {text.slice(0, idx)}
      <span className="ss-pen-highlight text-emerald-100 sm:whitespace-nowrap">{highlight}</span>
      {text.slice(idx + highlight.length)}
    </>
  )
}

function wrapEditorSection({
  editorMode,
  id,
  label,
  selectedBlockId,
  onSelectBlock,
  draggable,
  dragId,
  dropTargetId,
  dropPosition,
  onStartDrag,
  onNudgeSection,
  hidden,
  variant = 'section',
  children,
}) {
  if (!editorMode) return children
  const selected =
    selectedBlockId === id ||
    (id === 'hero' && HERO_INNER_BLOCK_IDS.has(selectedBlockId || ''))
  return (
    <EditableSectionOverlay
      id={id}
      label={label}
      selected={selected}
      hidden={hidden}
      draggable={draggable}
      dragging={dragId === id}
      variant={variant}
      dropTarget={dropTargetId === id && dragId !== id}
      dropPosition={dropPosition}
      onSelect={onSelectBlock}
      onStartDrag={onStartDrag}
      onNudge={onNudgeSection}
    >
      {children}
    </EditableSectionOverlay>
  )
}

/**
 * @param {{
 *   layout?: object,
 *   editorMode?: boolean,
 *   selectedBlockId?: string | null,
 *   onSelectBlock?: (id: string) => void,
 *   dragId?: string | null,
 *   dropTargetId?: string | null,
 *   dropPosition?: 'before' | 'after',
 *   onStartDrag?: (id: string, e: PointerEvent) => void,
 *   onNudgeSection?: (id: string, direction: 'up' | 'down') => void,
 *   onPatchHomeBlock?: (blockId: string, patch: object) => void,
 * }} props
 */
export function HomePageContent({
  layout: layoutProp,
  editorMode = false,
  editorViewport = 'desktop',
  selectedBlockId = null,
  onSelectBlock = () => {},
  dragId = null,
  dropTargetId = null,
  dropPosition = 'before',
  onStartDrag,
  onNudgeSection,
  showGrid = false,
  onPatchHomeBlock,
}) {
  const { openEntry } = useEntryFlow()
  const { competition: featuredCompetition, loading: featuredCompetitionLoading, error: featuredCompetitionError } =
    useFeaturedHomepageCompetition()
  const {
    competition: legacyCompetition,
    loading: legacyCompetitionLoading,
    error: legacyCompetitionError,
  } = usePublicCompetition(DRAW_COMPETITION_SLUG)
  const legacyCountdownPeriod = pickCountdownPeriod(legacyCompetition)
  const featuredCountdownPeriod = pickCountdownPeriod(featuredCompetition)
  const countdownPeriod = legacyCountdownPeriod || featuredCountdownPeriod
  const countdownPending =
    !countdownPeriod && (legacyCompetitionLoading || featuredCompetitionLoading)
  const countdownFetchFailed =
    !countdownPending &&
    !countdownPeriod &&
    Boolean(legacyCompetitionError || featuredCompetitionError)
  const countdownKnownEmpty =
    !countdownPending &&
    !countdownPeriod &&
    !countdownFetchFailed &&
    Boolean(legacyCompetition || featuredCompetition)
  const { layout: fetchedLayout } = useHomepageLayout()
  const layout = mergeHomepageLayout(layoutProp || fetchedLayout)
  const layoutViewport = useLayoutViewport({ editorMode, editorViewport })
  const { region, t } = useSiteLocale()
  const showPaidBundles = editorMode || region.paidBundlesAvailable
  const winners = usePublicWinners()
  const enterPaid = editorMode ? () => {} : (slug) => openEntry('paid', slug ? { competitionSlug: slug } : undefined)
  const enterGiveaway = editorMode ? () => {} : () => openEntry('kickups')
  const enterWorldCupBall = editorMode ? () => {} : () => openEntry('worldCupBall')

  const intro = layout.blocks.hero_intro
  const prizes = layout.blocks.hero_prizes
  const promo = layout.blocks.promo_strip
  const details = layout.blocks.hero_details
  const bundles = layout.blocks.ticket_bundles
  const winnersBlock = layout.blocks.winners_panel
  const hubBlock = layout.blocks.competitions_hub
  const iphonePanelBlock = layout.blocks.iphone_17_pro_panel
  const wcBallPanelBlock = layout.blocks.world_cup_ball_panel
  const blockOrder = (layout.blockOrder || HOMEPAGE_BLOCK_IDS).filter((id) => HOMEPAGE_BLOCK_IDS.includes(id))
  const sectionSequence = buildHomeSectionSequence(blockOrder)
  const detailsIdx = blockOrder.indexOf('hero_details')
  const bundlesIdx = blockOrder.indexOf('ticket_bundles')
  const bundlesBeforeDetails = detailsIdx >= 0 && bundlesIdx >= 0 && bundlesIdx < detailsIdx
  const prizesLeft = layout.heroColumnOrder === 'prizes-left'
  const introCol = prizesLeft ? 'md:col-start-2' : 'md:col-start-1'
  const prizeCol = prizesLeft ? 'md:col-start-1 md:row-start-1' : 'md:col-start-2 md:row-start-1'
  const detailsCol = prizesLeft
    ? bundlesBeforeDetails
      ? 'md:col-start-1 md:row-start-2'
      : 'md:col-start-2 md:row-start-2'
    : bundlesBeforeDetails
      ? 'md:col-start-2 md:row-start-2'
      : 'md:col-start-1 md:row-start-2'
  const bundleCol = prizesLeft
    ? bundlesBeforeDetails
      ? 'md:col-start-2 md:row-start-2'
      : 'md:col-start-1 md:row-start-2'
    : bundlesBeforeDetails
      ? 'md:col-start-1 md:row-start-2'
      : 'md:col-start-2 md:row-start-2'
  const heroBg = HERO_BG[layout.heroBackground] || kickupsHeroBg

  const dragHandlers = {
    dragId,
    dropTargetId,
    dropPosition,
    onStartDrag,
    onNudgeSection,
  }

  function dragWrap(id, label, blockId, offsetKey, block, node, scale = 1, opts = {}) {
    const desktopOffsets = block.offsets || {}
    const mobileOffsets = block.mobileOffsets || {}
    const resolvedOffsets = resolveLayoutOffsets(desktopOffsets, mobileOffsets, layoutViewport)
    const pos = resolvedOffsets?.[offsetKey] || { x: 0, y: 0, scale }
    const panelScale = pos.scale ?? scale
    const frameScale = opts.cssScaleOnly ? 1 : panelScale
    const widthOnly = !opts.uniformScale
    const transformOrigin = opts.transformOrigin || (opts.cssScaleOnly ? 'center top' : 'center center')

    if (!editorMode) {
      const style = liveOffsetStyle(pos, {
        cssScaleOnly: opts.cssScaleOnly,
        transformOrigin,
        widthOnly,
        scale: panelScale,
      })
      if (!style) return node
      return (
        <LiveLayoutOffset style={style} variant={opts.cssScaleOnly ? 'panel' : 'layout'} className={opts.className}>
          {node}
        </LiveLayoutOffset>
      )
    }

    return (
      <EditableDragFrame
        id={id}
        label={label}
        x={pos.x}
        y={pos.y}
        scale={frameScale}
        selected={selectedBlockId === id}
        onSelect={onSelectBlock}
        className={opts.className || 'block w-full max-w-full'}
        transformOrigin={transformOrigin}
        cssScaleOnly={opts.cssScaleOnly}
        widthOnly={widthOnly}
        scaleMin={opts.scaleMin}
        scaleMax={opts.scaleMax}
        onChange={(patch) => {
          const bucket = layoutViewport === EDITOR_VIEWPORT_MOBILE ? 'mobileOffsets' : 'offsets'
          const base = layoutViewport === EDITOR_VIEWPORT_MOBILE ? mobileOffsets : desktopOffsets
          onPatchHomeBlock?.(blockId, {
            [bucket]: { ...base, [offsetKey]: { ...pos, ...patch } },
          })
        }}
      >
        {node}
      </EditableDragFrame>
    )
  }

  function wrapBlock(blockId, label, node, visible = true) {
    if (!visible) return null
    return wrapEditorSection({
      editorMode,
      id: blockId,
      label,
      selectedBlockId,
      onSelectBlock,
      draggable: false,
      variant: 'block',
      hidden: false,
      ...dragHandlers,
      children: node,
    })
  }

  const hubVisible = isHomeBlockVisible(hubBlock)
  const winnersVisible = isHomeBlockVisible(winnersBlock)
  const iphonePanelVisible = iphonePanelBlock?.visible !== false
  const wcBallPanelVisible = wcBallPanelBlock?.visible !== false

  const iphonePanel =
    iphonePanelVisible || editorMode ? (
      <HomeIphone17ProPanel
        block={iphonePanelBlock}
        onEnter={() => enterPaid(IPHONE_17_PRO_COMPETITION_SLUG)}
        editorMode={editorMode}
      />
    ) : null

  const wcBallHeroPanel =
    wcBallPanelVisible || editorMode ? (
      <HomeWorldCupBallPanel
        block={wcBallPanelBlock}
        onEnter={enterWorldCupBall}
        editorMode={editorMode}
        embedded
      />
    ) : null

  const heroHidden =
    promo.visible === false &&
    intro.visible === false &&
    prizes.visible === false &&
    details.visible === false &&
    bundles.visible === false &&
    wcBallPanelBlock?.visible === false

  const winnersPanel = editorMode ? (
    winnersVisible ? (
      <HomeWinnersPanel
        title={winners.title || winnersBlock.title}
        subtitle={winners.subtitle || winnersBlock.subtitle}
        winners={winners.winners.slice(0, winnersBlock.maxItems || 3)}
        loading={false}
      />
    ) : (
      <HomeEditorHiddenSection
        label="Winners panel (hidden)"
        hint='Enable "Show on homepage" in section settings to display recent winners here.'
      />
    )
  ) : winnersVisible && winners.enabled ? (
    <HomeWinnersPanel
      title={winners.title || winnersBlock.title}
      subtitle={winners.subtitle || winnersBlock.subtitle}
      winners={winners.winners}
      loading={winners.loading}
    />
  ) : null

  const competitionsHub = hubVisible ? (
    <HomeCompetitionsHub
      block={hubBlock}
      onEnterPaid={(slug) => enterPaid(slug)}
      onEnterGiveaway={enterGiveaway}
    />
  ) : editorMode ? (
    <HomeEditorHiddenSection
      label="Competitions hub (hidden)"
      hint='Paid draws and free giveaways belong on the Competitions page. Enable "Show on homepage" only if you want this block here.'
    />
  ) : null


  const detailsOffsets = resolveLayoutOffsets(details.offsets || {}, details.mobileOffsets || {}, layoutViewport)
  const bundlesOffsets = resolveLayoutOffsets(bundles.offsets || {}, bundles.mobileOffsets || {}, layoutViewport)
  const detailsPanelScale = detailsOffsets.panel?.scale ?? 1
  const bundlesPanelScale = bundlesOffsets.panel?.scale ?? 1

  const matchedPanelKey = `${detailsPanelScale}-${bundlesPanelScale}-${details.visible}-${bundles.visible}`
  const { referenceRef: bundlesMeasureRef, targetRef: detailsMeasureRef } = useMatchedPanelHeight(matchedPanelKey, {
    enabled: details.visible !== false && bundles.visible !== false,
  })

  const promoBlock = dragWrap(
    'promo_badge',
    'Live badge',
    'promo_strip',
    'badge',
    promo,
    <p className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 sm:text-sm">
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
      {promo.livePromotionLabel || 'Live promotion'}
    </p>,
  )

  const introBlock = (
    <div
      className={`ss-hero-intro flex flex-col gap-4 text-left ${introCol} md:row-start-1`}
      data-editor-align-group
      data-editor-center-root
    >
      {promo.visible !== false
        ? editorMode
          ? wrapBlock('promo_strip', HOMEPAGE_BLOCK_LABELS.promo_strip, promoBlock)
          : promoBlock
        : null}
      {dragWrap(
        'intro_brand',
        'ShowSkills Rewards',
        'hero_intro',
        'brandTitle',
        intro,
        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          <h1 className="ss-hero-brand font-display text-[clamp(2.75rem,10vw,5.25rem)] leading-[0.92] tracking-tight sm:text-[clamp(3.25rem,11vw,5.75rem)]">
            {intro.brandTitle || 'ShowSkills Rewards'}
          </h1>
          <div className="flex items-end gap-1.5 sm:gap-2">
            <GlowingFootballIcon stagger={0} className="mb-1 shrink-0 sm:mb-1.5" />
            <GlowingFootballIcon stagger={1} className="mb-1 shrink-0 sm:mb-1.5" />
            <GlowingFootballIcon stagger={2} className="mb-1 shrink-0 sm:mb-1.5" />
          </div>
        </div>,
      )}
      {dragWrap(
        'intro_headline',
        'Headline',
        'hero_intro',
        'headline',
        intro,
        <p className="max-w-xl text-[clamp(1.35rem,4vw,2.1rem)] font-bold leading-snug tracking-tight text-white">
          <HeroHeadline text={intro.headline} highlight={intro.highlightPhrase} />
        </p>,
      )}
      {intro.consolationCopy ? (
        <p className="max-w-xl text-base leading-relaxed text-stone-400 md:text-sm lg:text-base">{intro.consolationCopy}</p>
      ) : null}
      {intro.helperCopy
        ? dragWrap(
            'intro_helper',
            'Helper text',
            'hero_intro',
            'helper',
            intro,
            <p className="ss-hero-helper-copy max-w-xl text-base leading-relaxed text-stone-400 md:text-sm lg:text-base">
              {intro.helperCopy}
            </p>,
          )
        : null}
      {dragWrap(
        'intro_cta_row',
        'CTA links',
        'hero_intro',
        'ctaRow',
        intro,
        <div className="ss-hero-cta-row mt-1 flex max-w-xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5 md:mt-auto md:border-t md:border-white/10 md:pt-4">
        <a
          href={editorMode ? undefined : '#prizes'}
          className="ss-hero-cta-prize-lineup inline-flex min-h-[3rem] w-full shrink-0 items-center justify-center rounded-xl border-2 border-emerald-400/40 bg-emerald-950/20 px-6 py-2.5 text-base font-bold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-950/40 sm:w-auto sm:min-h-[3.25rem] md:text-sm"
          onClick={editorMode ? (e) => e.preventDefault() : undefined}
        >
          {intro.prizeLineupLabel || 'Prize lineup'}
        </a>
        <Link
          to={editorMode ? '.' : '/archive/ronaldo-shirt-giveaway'}
          className="ss-hero-cta-shirt-link inline-flex w-full items-center justify-center self-center rounded-lg px-3 py-2 text-sm font-semibold text-stone-500 underline decoration-stone-600 underline-offset-4 hover:text-stone-300 sm:w-auto sm:py-2.5 md:text-xs"
          onClick={editorMode ? (e) => e.preventDefault() : undefined}
        >
          {intro.shirtLinkLabel || 'Free shirt giveaway'}
        </Link>
        </div>,
      )}
    </div>
  )

  const prizesBlock = (() => {
    const prizeImages = mergePrizeImages(prizes.prizeImages)

    function prizeFrame(key, label, node) {
      const pos = prizeImages[key] || { x: 0, y: 0, scale: 1 }
      if (!editorMode) {
        const style = liveOffsetStyle(pos, { widthOnly: true, scale: pos.scale ?? 1 })
        if (!style) return node
        return (
          <LiveLayoutOffset style={style} variant="card">
            {node}
          </LiveLayoutOffset>
        )
      }
      return (
        <EditableDragFrame
          id={`prize_${key}`}
          label={label}
          x={pos.x}
          y={pos.y}
          scale={pos.scale}
          selected={selectedBlockId === `prize_${key}`}
          onSelect={onSelectBlock}
          className="block w-full max-w-full"
          onChange={(patch) =>
            onPatchHomeBlock?.('hero_prizes', {
              prizeImages: { ...prizeImages, [key]: { ...pos, ...patch } },
            })
          }
        >
          {node}
        </EditableDragFrame>
      )
    }

    const studioPanel = (
      <div className="ss-prize-studio ss-prize-studio--hero p-2 sm:p-3">
          <div className="relative z-[1] grid gap-2" data-editor-align-group data-editor-center-root>
            <div className="ss-prize-studio-tile ss-prize-studio-tile--main text-center">
              <div className="ss-prize-studio-photo overflow-hidden">
                {prizeFrame(
                  'poster',
                  'Bundle poster',
                  <>
                    <img
                      src={legacyBundlePoster}
                      alt="Signed Legacy Bundle: signed shirt, signed ball and gold phone case in a luxury poster layout."
                      width={1024}
                      height={576}
                      loading="eager"
                      decoding="async"
                      className="h-auto w-full"
                    />
                    <LegacyBundlePosterTitle />
                    <LegacyBundleImageryCaption />
                  </>,
                )}
              </div>
            </div>
            <div className="ss-prize-studio-subgrid mx-auto grid w-full max-w-[20rem] grid-cols-2 gap-2 sm:gap-0">
              <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                <div className="ss-prize-tile-photo overflow-hidden rounded-md">
                  {prizeFrame(
                    'phone',
                    'Phone',
                    <IphonePrizePhoto loading="eager" decoding="async" />,
                  )}
                </div>
                <div className="ss-prize-tile-caption">
                  <p className="ss-phone-prize-glow mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em]">
                    Phone prize
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-stone-100">iPhone 17 Pro Max</p>
                </div>
              </div>
              <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                <div className="ss-prize-tile-photo overflow-hidden rounded-md">
                  {prizeFrame('case', 'Gold case', <GoldCasePrizePhoto loading="eager" />)}
                </div>
                <div className="ss-prize-tile-caption">
                  <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em] text-amber-300/90">
                    Case prize
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-stone-100">24K gold case</p>
                </div>
              </div>
            </div>
            <LegacyBundleImageryDisclaimer />
          </div>
        </div>
    )

    return (
    <div className={`ss-hero-prize-stack flex flex-col gap-2 ${prizeCol} md:min-h-0 md:gap-2.5`}>
      <div id={editorMode ? undefined : 'prizes'} className="ss-hero-prize-column scroll-mt-24">
        {dragWrap(
          'prizes_studio',
          'Prize studio panel',
          'hero_prizes',
          'studioPanel',
          prizes,
          studioPanel,
          1,
          { className: 'w-full', transformOrigin: 'top center' },
        )}
      </div>

      <div
        className="ss-hero-bundle-cta mt-1 flex w-full flex-col items-center gap-2.5 text-center md:mt-auto md:gap-3"
        data-editor-align-group
        data-editor-center-root
      >
        <div className="ss-hero-countdown-slot flex min-h-[2.85rem] w-full items-center justify-center px-1 sm:min-h-[3rem]">
          {countdownFetchFailed ? (
            <p className="text-center text-xs text-stone-500" role="status">
              Could not load entry dates — refresh the page or run <code className="text-stone-400">npm run dev:all</code>{' '}
              locally.
            </p>
          ) : (
            dragWrap(
              'prizes_countdown',
              'Countdown timer',
              'hero_prizes',
              'countdown',
              prizes,
              <CompetitionCountdown
                opensAt={countdownPeriod?.entryOpensAt}
                closesAt={countdownPeriod?.entryClosesAt}
                label="Competition ends"
                live={!editorMode}
                showDot={false}
                pending={countdownPending}
                showUnknown={countdownKnownEmpty}
                className="max-w-[min(100%,22rem)] text-center sm:max-w-xl"
              />,
              1,
              { className: 'block w-fit max-w-full', transformOrigin: 'top center', uniformScale: true },
            )
          )}
        </div>
        {prizes.ctaBlurb
          ? dragWrap(
              'prizes_cta_blurb',
              'Ticket blurb',
              'hero_prizes',
              'ctaBlurb',
              prizes,
              <p className="ss-hero-bundle-cta-blurb mx-auto max-w-md text-center text-stone-500">{prizes.ctaBlurb}</p>,
              1,
              { className: 'w-full', transformOrigin: 'top center' },
            )
          : null}
        {dragWrap(
          'prizes_cta_button',
          'Enter Bundle Draw',
          'hero_prizes',
          'ctaButton',
          prizes,
          <div className="ss-hero-bundle-cta-actions flex w-full flex-col items-center justify-center gap-2 md:border-t md:border-white/10 md:pt-3 lg:pt-4">
            {showPaidBundles ? (
              <button
                type="button"
                onClick={() => enterPaid()}
                className="ss-hero-bundle-draw-btn"
                tabIndex={editorMode ? -1 : undefined}
              >
                {prizes.ctaButtonLabel || 'Enter Bundle Draw'}
              </button>
            ) : (
              <p className="max-w-md text-center text-sm leading-relaxed text-amber-100/85">
                {t('home.enterBundleUnavailable')}{' '}
                <Link to="/competitions#free-giveaways" className="font-semibold text-amber-300 underline">
                  {t('competitions.freeSection')}
                </Link>
              </p>
            )}
          </div>,
          1,
          { className: 'w-full', transformOrigin: 'top center' },
        )}
      </div>
    </div>
    )
  })()

  const detailsBlock = (
    <div ref={detailsMeasureRef} className={`ss-hero-copy-footer flex w-full ${detailsCol}`}>
      {dragWrap(
        'details_panel',
        'Signed Legacy Bundle details',
        'hero_details',
        'panel',
        details,
        <div
          className="ss-legacy-details-card ss-hero-panel-card flex w-full max-w-none flex-col rounded-lg"
          style={{ '--ss-panel-scale': detailsPanelScale }}
        >
          <div className="ss-legacy-details-inner flex min-h-0 flex-1 flex-col">
          <h2 className="ss-legacy-details-title">{details.title || 'Signed Legacy Bundle details'}</h2>
          <section className="ss-legacy-details-block" aria-labelledby="ss-legacy-prize-stack-heading">
            <h3 id="ss-legacy-prize-stack-heading" className="ss-legacy-details-kicker">
              Prize stack
            </h3>
            <ul className="ss-legacy-prize-stack">
              {BUNDLE_OFFER_ITEMS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="ss-legacy-value-blurb">
              Estimated total stack value is <strong>over £3,000</strong>, with collector legacy value from the certified
              Ronaldo shirt and certified museum signed football.
            </p>
          </section>
          <section
            className="ss-legacy-details-block ss-legacy-details-block--notes"
            aria-labelledby="ss-legacy-prize-notes-heading"
          >
            <h3 id="ss-legacy-prize-notes-heading" className="ss-legacy-details-kicker">
              Prize notes
            </h3>
            <dl className="ss-legacy-spec-list">
              {LEGACY_BUNDLE_SPECS.map(({ label, body }) => (
                <div key={label} className="ss-legacy-spec-row">
                  <dt>{label}</dt>
                  <dd>{body}</dd>
                </div>
              ))}
            </dl>
          </section>
          <p className="ss-legacy-details-footnote mt-auto shrink-0">
            <span className="text-amber-300/85" aria-hidden>
              *
            </span>{' '}
            Images are illustrative. Prize details are subject to the competition terms and availability.
          </p>
          </div>
        </div>,
        1,
        { className: 'w-full', transformOrigin: 'top center', cssScaleOnly: true },
      )}
    </div>
  )

  const bundlesBlock = (
    <div ref={bundlesMeasureRef} className={`ss-hero-ticket-bundles w-full ${bundleCol}`}>
      {dragWrap(
        'bundles_panel',
        'Ticket bundles',
        'ticket_bundles',
        'panel',
        bundles,
        <TicketBundlePrice
          className="ss-hero-panel-card ss-hero-matched-panel h-full"
          style={{ '--ss-panel-scale': bundlesPanelScale }}
        />,
        1,
        { className: 'w-full', transformOrigin: 'top center', cssScaleOnly: true },
      )}
    </div>
  )

  const heroSection = (
    <section className="ss-hero-surface relative -mt-px overflow-x-clip overflow-y-visible border-b border-emerald-900/20 pt-0 pb-6 sm:pb-10">
      <div
        className="pointer-events-none absolute inset-0 z-[1] min-h-[22rem] overflow-hidden bg-[#071512] sm:min-h-0"
        aria-hidden
      >
        <img
          src={heroBg}
          alt=""
          width={800}
          height={1200}
          decoding="async"
          fetchPriority="high"
          className="ss-hero-photo-bg-img"
        />
        <div className="ss-hero-photo-pitch-tint absolute inset-0" />
        <div className="ss-hero-photo-scrim absolute inset-0" />
      </div>

      <div className="ss-hero-inner mx-auto max-w-5xl px-4 pt-5 pb-14 sm:px-6 sm:pt-11 sm:pb-10 lg:pt-12 lg:pb-20">
        <article className="ss-hero-merged-panel relative z-[2] grid gap-5 px-0 py-4 sm:gap-6 sm:py-5 md:grid-cols-2 md:items-stretch md:gap-x-5 md:gap-y-4 md:px-4 md:py-5 lg:gap-x-7 lg:gap-y-3 lg:p-6">
          {intro.visible !== false
            ? wrapBlock('hero_intro', HOMEPAGE_BLOCK_LABELS.hero_intro, introBlock)
            : null}
          {prizes.visible !== false
            ? wrapBlock('hero_prizes', HOMEPAGE_BLOCK_LABELS.hero_prizes, prizesBlock)
            : null}
          {details.visible !== false
            ? wrapBlock('hero_details', HOMEPAGE_BLOCK_LABELS.hero_details, detailsBlock)
            : null}
          {bundles.visible !== false && showPaidBundles
            ? wrapBlock('ticket_bundles', HOMEPAGE_BLOCK_LABELS.ticket_bundles, bundlesBlock)
            : null}
          {wcBallPanelVisible || editorMode
            ? wrapBlock(
                'world_cup_ball_panel',
                HOMEPAGE_BLOCK_LABELS.world_cup_ball_panel,
                wcBallHeroPanel,
              )
            : null}
        </article>
      </div>
    </section>
  )

  return (
    <main
      className={`m-0 p-0 ${editorMode ? 'ss-page-editor-preview [&_button:not([data-editor-ui])]:pointer-events-none' : ''} ${editorMode && showGrid ? 'ss-editor-show-grid' : ''}`}
      onClick={
        editorMode
          ? (e) => {
              const block = e.target.closest('[data-editor-section]')
              if (block?.dataset?.editorSection) onSelectBlock(block.dataset.editorSection)
            }
          : undefined
      }
    >
      {sectionSequence.map((section) => {
        if (section === 'competitions_hub' && !competitionsHub) return null
        if (section === 'winners_panel' && !winnersPanel) return null
        if (section === 'iphone_17_pro_panel' && !iphonePanel) return null
        if (section === 'hero') {
          return (
            <div key="hero">
              {wrapEditorSection({
                editorMode,
                id: 'hero',
                label: 'Hero section',
                selectedBlockId,
                onSelectBlock,
                draggable: true,
                ...dragHandlers,
                hidden: heroHidden,
                children: heroSection,
              })}
            </div>
          )
        }
        if (section === 'competitions_hub') {
          return (
            <div key="competitions_hub">
              {wrapEditorSection({
                editorMode,
                id: 'competitions_hub',
                label: HOMEPAGE_BLOCK_LABELS.competitions_hub,
                selectedBlockId,
                onSelectBlock,
                draggable: true,
                ...dragHandlers,
                hidden: editorMode ? false : !hubVisible,
                children: competitionsHub,
              })}
            </div>
          )
        }
        if (section === 'iphone_17_pro_panel') {
          return (
            <div key="iphone_17_pro_panel">
              {wrapEditorSection({
                editorMode,
                id: 'iphone_17_pro_panel',
                label: HOMEPAGE_BLOCK_LABELS.iphone_17_pro_panel,
                selectedBlockId,
                onSelectBlock,
                draggable: true,
                ...dragHandlers,
                hidden: editorMode ? false : !iphonePanelVisible,
                children: iphonePanel,
              })}
            </div>
          )
        }
        if (section === 'winners_panel') {
          return (
            <div key="winners_panel">
              {wrapEditorSection({
                editorMode,
                id: 'winners_panel',
                label: HOMEPAGE_BLOCK_LABELS.winners_panel,
                selectedBlockId,
                onSelectBlock,
                draggable: true,
                ...dragHandlers,
                hidden: editorMode ? false : !winnersVisible,
                children: winnersPanel,
              })}
            </div>
          )
        }
        return null
      })}
    </main>
  )
}

export default function HomePage() {
  return <HomePageContent />
}
