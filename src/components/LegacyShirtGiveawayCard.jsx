import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import {
  SHIRT_GIVEAWAY_DETAILS_PATH,
  SHIRT_GIVEAWAY_HOW_TO_HASH,
  SHIRT_GIVEAWAY_SEASON_LABEL,
  SHIRT_GIVEAWAY_PRIZE_TITLE,
} from '../../shared/shirtGiveaway.mjs'
import { SHIRT_GIVEAWAY_CARD_STEP_TITLES } from '../../shared/shirtGiveawayEntryRequirements.mjs'
import { defaultShirtGiveawayCardLayout } from '../../shared/sitePageLayout.mjs'
import { liveOffsetStyle } from '../../shared/layoutOffsets.mjs'
import { LiveLayoutOffset } from './LiveLayoutOffset'
import { CompetitionCountdown } from './CompetitionCountdown'
import { EditableDragFrame } from './admin/EditableDragFrame'
import { pickCountdownPeriod } from '../../shared/competitionPeriods.mjs'

/**
 * Legacy Ronaldo shirt giveaway — kickups submission flow (not catalog main draw).
 */
export const LegacyShirtGiveawayCard = forwardRef(function LegacyShirtGiveawayCard(
  {
    onEnter,
    className = '',
    style,
    cardScale = 1,
    cardLayout: cardLayoutProp,
    countdownPeriod = null,
    countdownPending = false,
    editorMode = false,
    selectedBlockId = null,
    onSelectBlock,
    onPatchCardLayout,
  },
  ref,
) {
  const scale = cardScale ?? style?.['--ss-shirt-card-scale'] ?? 1
  const period = pickCountdownPeriod(
    countdownPeriod ? { countdownPeriod, openPeriod: countdownPeriod } : null,
  )
  const cardLayout = { ...defaultShirtGiveawayCardLayout(), ...(cardLayoutProp || {}) }
  const cardOffsets = cardLayout.offsets || {}
  const headlineGapPx = cardLayout.headlineGapPx ?? 12

  const badgeLabel = cardLayout.badgeLabel?.trim() || 'Free giveaway'
  const titleText = cardLayout.title?.trim() || 'Ronaldo Shirt Giveaway'
  const prizeLine = cardLayout.prizeLine?.trim() || SHIRT_GIVEAWAY_PRIZE_TITLE
  const helperLine = cardLayout.helperLine?.trim() || 'No payment or video upload.'
  const stepsHeading = cardLayout.stepsHeading?.trim() || 'What you need to do'
  const stepsLinkLabel = cardLayout.stepsLinkLabel?.trim() || 'Full entry steps'
  const enterLabel = cardLayout.enterButtonLabel?.trim() || 'Enter free giveaway'
  const prizeImage = cardLayout.prizeImageUrl?.trim() || KICKUPS_GIVEAWAY_IMAGE
  const stepTitles = (cardLayout.stepLabels || []).map((label, index) =>
    label?.trim() ? label.trim() : SHIRT_GIVEAWAY_CARD_STEP_TITLES[index] || '',
  )

  function cardDragWrap(id, label, offsetKey, node, opts = {}) {
    const moveOnly = opts.moveOnly === true
    const widthOnly = opts.uniformScale ? false : opts.widthOnly !== false
    const raw = cardOffsets[offsetKey] || { x: 0, y: 0, scale: 1 }
    const pos = moveOnly ? { ...raw, scale: 1 } : raw
    if (!editorMode) {
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

  const spacer = <div className="ss-competition-card-focus__spacer" aria-hidden />

  const imageryPanel = (
    <div className="mx-auto w-full max-w-[min(100%,19rem)] overflow-hidden rounded-lg border border-lime-400/35 bg-black shadow-inner sm:max-w-[min(100%,21rem)]">
      <img
        src={prizeImage}
        alt={`Prize: signed Cristiano Ronaldo Manchester United number 7 shirt, ${SHIRT_GIVEAWAY_SEASON_LABEL}.`}
        width={771}
        height={1024}
        className="h-auto w-full object-cover object-top"
        loading="lazy"
        decoding="async"
      />
    </div>
  )

  const stepsPanel = (
    <div className="mx-auto w-full max-w-[28rem] rounded-xl border border-lime-400/25 bg-lime-950/20 px-3 py-2.5 text-left">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-300/80">{stepsHeading}</p>
      <ol className="mt-2 list-none space-y-1.5">
        {stepTitles.map((title, index) => (
          <li key={`${index}-${title}`} className="flex gap-2 text-sm leading-snug">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-[10px] font-bold text-lime-200"
              aria-hidden
            >
              {index + 1}
            </span>
            <span className="min-w-0 text-stone-300">{title}</span>
          </li>
        ))}
      </ol>
      <Link
        to={`${SHIRT_GIVEAWAY_DETAILS_PATH}${SHIRT_GIVEAWAY_HOW_TO_HASH}`}
        className="mt-2 inline-block text-xs font-medium text-lime-400/85 underline decoration-lime-700/50 underline-offset-2 hover:text-lime-300"
        onClick={editorMode ? (e) => e.preventDefault() : undefined}
        tabIndex={editorMode ? -1 : undefined}
      >
        {stepsLinkLabel}
      </Link>
    </div>
  )

  const enterButton = cardDragWrap(
    'comp_shirt_card_enter',
    'Enter button',
    'enter',
    <div className="ss-competition-card-actions ss-competition-card-footer">
      <button
        type="button"
        onClick={onEnter}
        tabIndex={editorMode ? -1 : undefined}
        className="ss-competition-enter-btn ss-competition-enter-btn--free"
      >
        {enterLabel}
      </button>
    </div>,
    { widthOnly: false },
  )

  return (
    <article
      ref={ref}
      data-competition-card
      data-shirt-giveaway-card
      className={`ss-shirt-giveaway-card flex h-full w-full max-w-none flex-col overflow-hidden rounded-2xl border border-lime-400/30 bg-stone-950/80 shadow-[0_16px_48px_rgba(0,0,0,0.4)] ${
        editorMode ? 'overflow-visible' : ''
      } ${className}`}
      style={{
        ...style,
        '--ss-shirt-card-scale': scale,
        '--ss-competition-headline-gap': `${headlineGapPx}px`,
      }}
    >
      <div
        className={`ss-shirt-giveaway-card__body flex min-h-0 flex-1 flex-col px-6 pb-0 pt-4 text-left sm:px-8 sm:pt-5 ${
          editorMode ? 'overflow-visible' : ''
        }`}
        data-editor-align-group
        data-editor-center-root
      >
        <div className="w-full shrink-0">
          {cardDragWrap('comp_shirt_card_image', 'Shirt prize image', 'imagery', imageryPanel)}
          {spacer}
          {cardDragWrap(
            'comp_shirt_card_badge',
            'Free giveaway badge',
            'badge',
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-lime-300/90">{badgeLabel}</p>,
            { widthOnly: false },
          )}
          {spacer}
          {cardDragWrap(
            'comp_shirt_card_title',
            'Giveaway title',
            'title',
            <h2 className="font-display text-xl font-bold leading-tight text-white sm:text-2xl">{titleText}</h2>,
            { widthOnly: false },
          )}
          {spacer}
          {cardDragWrap(
            'comp_shirt_card_prize',
            'Prize line',
            'prizeLine',
            <p className="text-sm leading-snug text-stone-500">{prizeLine}</p>,
            { widthOnly: false },
          )}
          {spacer}
          {cardDragWrap(
            'comp_shirt_card_helper',
            'Helper line',
            'helper',
            <p className="text-sm text-stone-500">{helperLine}</p>,
            { widthOnly: false },
          )}
        </div>

        {spacer}
        {cardDragWrap(
          'comp_shirt_card_timer',
          'Countdown timer',
          'timer',
          period || countdownPending ? (
            <CompetitionCountdown
              opensAt={period?.entryOpensAt}
              closesAt={period?.entryClosesAt}
              label="Giveaway ends"
              showDot={false}
              pending={countdownPending}
              live={!editorMode}
              theme="lime"
            />
          ) : (
            <p className="text-xs text-amber-200/80">Entry dates not set yet — configure them in admin.</p>
          ),
          {
            uniformScale: true,
            transformOrigin: 'top center',
            scaleMin: 0.75,
            scaleMax: 1.35,
          },
        )}

        {spacer}
        {cardDragWrap('comp_shirt_card_steps', 'Entry steps box', 'steps', stepsPanel, { widthOnly: false })}
      </div>

      {enterButton}
    </article>
  )
})
