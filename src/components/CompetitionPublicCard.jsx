import { CompetitionCountdown } from './CompetitionCountdown'
import { LegacyBundlePhonePrizes } from './LegacyBundlePhonePrizes'
import { LegacyBundleImageryDisclaimer } from './LegacyBundleImageryDisclaimer'
import { LegacyBundleImageryCaption } from './LegacyBundleImageryCaption'
import { EditableDragFrame } from './admin/EditableDragFrame'
import { formatBundlePriceGBP } from '../competitionData'
import { POSTAL_ENTRY_ADDRESS } from '../competitionData'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import { publicCompetitionSummary } from '../lib/publicCompetitionCopy'
import { defaultLegacyBundleCardLayout } from '../../shared/sitePageLayout.mjs'
import { liveOffsetStyle } from '../../shared/layoutOffsets.mjs'
import { LiveLayoutOffset } from './LiveLayoutOffset'
import { DRAW_COMPETITION_SLUG, formatPeriodMonthLabel, pickCountdownPeriod } from '../../shared/competitionPeriods.mjs'

const DEFAULT_SUMMARY =
  'Pay for ticket bundles or use free entry routes, then answer three skill questions to qualify for the draw.'

function bundlePriceLine(competition) {
  if (!competition?.allowPaidEntry) return 'Free entry routes only'
  if (competition.minBundlePence != null) {
    const max = competition.bundles?.length
      ? Math.max(...competition.bundles.map((b) => b.totalPence))
      : competition.minBundlePence
    if (competition.minBundlePence === max) {
      return `From ${formatBundlePriceGBP(competition.minBundlePence)}`
    }
    return `From ${formatBundlePriceGBP(competition.minBundlePence)} · bundles to ${formatBundlePriceGBP(max)}`
  }
  return 'Paid ticket bundles available'
}

/**
 * @param {{
 *   competition: object,
 *   onEnter?: () => void,
 *   preview?: boolean,
 *   draft?: boolean,
 *   layout?: 'card' | 'page',
 *   cardLayout?: object,
 *   cardScale?: number,
 *   editorMode?: boolean,
 *   selectedBlockId?: string | null,
 *   onSelectBlock?: (id: string) => void,
 *   onPatchCardLayout?: (patch: object) => void,
 * }} props
 */
export function CompetitionPublicCard({
  competition,
  onEnter,
  preview = false,
  draft = false,
  layout = 'card',
  className = '',
  cardLayout: cardLayoutProp,
  cardScale = 1,
  editorMode = false,
  selectedBlockId = null,
  onSelectBlock,
  onPatchCardLayout,
}) {
  if (!competition) return null

  const isPageLayout = layout === 'page'
  const isLegacyBundle = competition.slug === DRAW_COMPETITION_SLUG
  const cardLayout = isLegacyBundle
    ? { ...defaultLegacyBundleCardLayout(), ...(cardLayoutProp || {}) }
    : null
  const cardOffsets = cardLayout?.offsets || {}
  const headlineGapPx = cardLayout?.headlineGapPx ?? 14
  const countdownPeriod = pickCountdownPeriod(competition)
  const periodMonth = formatPeriodMonthLabel(countdownPeriod?.entryClosesAt)
  const hero =
    competition.heroImageUrl ||
    (isLegacyBundle ? legacyBundlePoster : null)
  const gallery = (competition.galleryUrls || []).filter(Boolean)
  const subImages = isLegacyBundle ? [] : gallery.slice(0, 2)
  const summaryOverride = cardLayout?.summary?.trim()
  const summary = summaryOverride || publicCompetitionSummary(competition, DEFAULT_SUMMARY)
  const titleText = cardLayout?.title?.trim() || competition.title
  const metaFeaturedLabel =
    cardLayout?.metaFeaturedLabel?.trim() ||
    (competition.featuredOnHomepage ? 'Featured · Main prize' : 'Main prize draw')
  const enterLabel = cardLayout?.enterButtonLabel?.trim() || 'Enter this competition'

  function cardDragWrap(id, label, offsetKey, node, opts = {}) {
    const moveOnly = opts.moveOnly === true
    const widthOnly = opts.uniformScale ? false : opts.widthOnly !== false
    const raw = cardOffsets[offsetKey] || { x: 0, y: 0, scale: 1 }
    const pos = moveOnly ? { ...raw, scale: 1 } : raw
    if (!editorMode || !isLegacyBundle) {
      const style = liveOffsetStyle(moveOnly ? { x: pos.x, y: pos.y, scale: 1 } : pos, {
        transformOrigin: opts.transformOrigin || 'center top',
        widthOnly: moveOnly ? true : widthOnly,
        scale: moveOnly ? 1 : (pos.scale ?? 1),
      })
      if (!style) return node
      return (
        <LiveLayoutOffset style={style} variant="card" className={opts.className}>
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
        scale={pos.scale ?? 1}
        selected={selectedBlockId === id}
        onSelect={onSelectBlock}
        className={opts.className || 'block w-full max-w-full'}
        transformOrigin={opts.transformOrigin || 'center top'}
        widthOnly={moveOnly ? true : widthOnly}
        moveOnly={moveOnly}
        scaleMin={opts.scaleMin}
        scaleMax={opts.scaleMax}
        onChange={(patch) =>
          onPatchCardLayout?.({
            offsets: {
              ...cardOffsets,
              [offsetKey]: moveOnly
                ? { x: patch.x ?? pos.x, y: patch.y ?? pos.y, scale: 1 }
                : { ...pos, ...patch },
            },
          })
        }
      >
        {node}
      </EditableDragFrame>
    )
  }

  const imageryPanel = (
    <div className="bg-gradient-to-b from-teal-950/50 via-stone-950/80 to-stone-950 px-4 pb-2 pt-7 sm:px-6">
      <div
        className={`ss-prize-studio mx-auto p-2 sm:p-3 ${
          isPageLayout ? 'ss-prize-studio--hero max-w-2xl' : 'max-w-xl'
        }`}
      >
        <div className="relative z-[1] grid gap-2">
          <div className="ss-prize-studio-tile ss-prize-studio-tile--main text-center">
            <div className="ss-prize-studio-photo">
              {hero ? (
                <>
                  <img
                    src={hero}
                    alt=""
                    className={`h-auto w-full object-cover ${isPageLayout ? '' : 'max-h-72'}`}
                    loading="lazy"
                    decoding="async"
                  />
                  {isLegacyBundle ? <LegacyBundleImageryCaption /> : null}
                </>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-stone-900/80 text-sm text-stone-500">
                  Upload a hero image in admin
                </div>
              )}
            </div>
          </div>
          {isLegacyBundle ? <LegacyBundlePhonePrizes compact={!isPageLayout} /> : null}
          {isLegacyBundle ? <LegacyBundleImageryDisclaimer /> : null}
          {subImages.length ? (
            <div
              className={`ss-prize-studio-subgrid mx-auto grid w-full gap-2 ${
                isPageLayout ? 'max-w-[20rem] grid-cols-2 sm:gap-0' : 'gap-1.5 sm:max-w-[17rem] sm:grid-cols-2 sm:gap-2'
              }`}
            >
              {subImages.map((url) => (
                <div key={url} className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                  <div
                    className={`ss-prize-studio-photo mx-auto overflow-hidden rounded-md ${
                      isPageLayout ? 'max-w-[7.5rem]' : 'max-w-[7rem]'
                    }`}
                  >
                    <img src={url} alt="" className="aspect-[3/4] h-auto w-full object-cover" loading="lazy" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const headlinePanel = (
    <div
      className={`flex min-h-0 flex-1 flex-col px-6 pt-2 pb-0 sm:px-8 sm:pt-2.5 ${editorMode && isLegacyBundle ? 'overflow-visible' : ''}`}
    >
      {cardDragWrap(
        'comp_paid_card_meta',
        'Meta labels',
        'meta',
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-400/90">{metaFeaturedLabel}</p>
          {periodMonth ? (
            <>
              <span className="hidden text-teal-600/40 sm:inline" aria-hidden>
                ·
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-400/90">{periodMonth} draw</p>
            </>
          ) : null}
        </div>,
      )}
      {cardDragWrap(
        'comp_paid_card_timer',
        'Countdown timer',
        'timer',
        countdownPeriod ? (
          <CompetitionCountdown
            opensAt={countdownPeriod.entryOpensAt}
            closesAt={countdownPeriod.entryClosesAt}
            showDot={false}
            live={!editorMode}
            className="!m-0 max-w-[min(100%,22rem)] text-center sm:max-w-xl"
          />
        ) : (
          <p className="text-xs text-amber-200/80">No entry period dates yet — set them in admin.</p>
        ),
        {
          uniformScale: true,
          transformOrigin: 'top center',
          scaleMin: 0.75,
          scaleMax: 1.35,
        },
      )}
      <div className="ss-competition-card-focus__spacer" aria-hidden />
      {cardDragWrap(
        'comp_paid_card_title',
        'Competition title',
        'title',
        <h2 className="font-display text-2xl uppercase leading-[0.88] tracking-wide text-white sm:text-3xl">{titleText}</h2>,
        { widthOnly: false },
      )}
      <div className="ss-competition-card-focus__spacer" aria-hidden />
      {cardDragWrap(
        'comp_paid_card_summary',
        'Summary text',
        'summary',
        <p className="text-sm leading-relaxed text-stone-500 sm:text-base">{summary}</p>,
        { widthOnly: false },
      )}
      <div className="ss-competition-card-focus__spacer" aria-hidden />
      {cardDragWrap(
        'comp_paid_card_price',
        'Price badge',
        'price',
        <p className="inline-flex w-fit rounded-lg border border-emerald-400/30 bg-emerald-950/35 px-3 py-1.5 text-sm font-display text-emerald-50 sm:text-base">
          {bundlePriceLine(competition)}
        </p>,
        { widthOnly: false },
      )}
      {competition.allowPostalEntry ? (
        <p className="mt-2 text-xs text-stone-600 sm:text-sm">
          Postal entries: write <span className="text-stone-400">{competition.postalCompetitionName}</span> on your
          envelope → {POSTAL_ENTRY_ADDRESS}
        </p>
      ) : null}
    </div>
  )

  const enterButton =
    isLegacyBundle && (editorMode || (!preview && onEnter))
      ? cardDragWrap(
          'comp_paid_card_enter',
          'Enter button',
          'enter',
          <div className="ss-competition-card-actions ss-competition-card-footer">
            <button
              type="button"
              onClick={onEnter}
              tabIndex={editorMode ? -1 : undefined}
              className="ss-competition-enter-btn ss-competition-enter-btn--paid"
            >
              {enterLabel}
            </button>
          </div>,
          { widthOnly: false },
        )
      : null

  return (
    <article
      data-competition-card
      className={`flex h-full flex-col rounded-2xl border border-teal-500/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${
        editorMode && isLegacyBundle ? 'overflow-visible' : 'overflow-hidden'
      } ${isPageLayout ? 'ss-competition-page-card' : ''} ${preview ? 'pointer-events-none select-none' : ''} ${className}`}
      style={{
        ...(isLegacyBundle && cardScale !== 1 ? { '--ss-competition-card-scale': cardScale } : undefined),
        ...(isLegacyBundle ? { '--ss-competition-headline-gap': `${headlineGapPx}px` } : undefined),
      }}
    >
      {draft ? (
        <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-amber-200/90">
          Draft preview — publish to go live on site
        </div>
      ) : null}
      {isLegacyBundle
        ? cardDragWrap('comp_paid_card_image', 'Bundle prize images', 'imagery', imageryPanel)
        : imageryPanel}
      <div
        className={`flex min-h-0 flex-1 flex-col ${editorMode && isLegacyBundle ? 'overflow-visible' : ''}`}
        data-editor-align-group
        data-editor-center-root
      >
        {headlinePanel}
        {enterButton}
        {!isLegacyBundle && !preview && onEnter ? (
          <div className="ss-competition-card-actions ss-competition-card-footer">
            <button
              type="button"
              onClick={onEnter}
              className="ss-competition-enter-btn ss-competition-enter-btn--paid"
            >
              Enter this competition
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
