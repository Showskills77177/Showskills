/**
 * Generates a branded "Winner's Cheque" PNG for cash-prize giveaways (currently World Cup Ball),
 * overlaying dynamic fields onto the fixed ShowSkills cheque template design.
 *
 * Rendering pipeline:
 *  1. satori lays out the dynamic text fields with embedded fonts (no OS/fontconfig dependency —
 *     this is what makes it reliable inside Vercel's serverless runtime, unlike SVG <text> with
 *     @font-face, which silently falls back to a generic system font there).
 *  2. @resvg/resvg-js rasterizes that SVG to a transparent PNG.
 *  3. sharp composites the rasterized text on top of the template PNG and re-encodes the result.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { numberToUsdWords } from '../../../shared/numberToWords.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..', '..')

const TEMPLATE_PATH = join(REPO_ROOT, 'public', 'email', 'wcb-cheque-template.png')
const OSWALD_BOLD_PATH = join(REPO_ROOT, 'public', 'fonts', 'Oswald-Bold.ttf')
const DM_SANS_BOLD_PATH = join(REPO_ROOT, 'public', 'fonts', 'DMSans-Bold.ttf')

const CANVAS_WIDTH = 2000
const CANVAS_HEIGHT = 1342
const OUTPUT_WIDTH = 1400 // downscaled on export to keep email attachment size reasonable
const GOLD = '#D9AD5B'
const CREAM = '#EAE6E2'

let cachedAssets = null
function loadAssets() {
  if (!cachedAssets) {
    cachedAssets = {
      template: readFileSync(TEMPLATE_PATH),
      oswaldBold: readFileSync(OSWALD_BOLD_PATH),
      dmSansBold: readFileSync(DM_SANS_BOLD_PATH),
    }
  }
  return cachedAssets
}

/** Shrinks font-size for long strings so they still fit their box on one line. */
function fitFontSize(text, baseSize, maxChars) {
  const len = String(text || '').length
  if (len <= maxChars) return baseSize
  return Math.max(baseSize * (maxChars / len), baseSize * 0.55)
}

function formatChequeDate(dateIso) {
  try {
    const d = dateIso ? new Date(dateIso) : new Date()
    if (Number.isNaN(d.getTime())) throw new Error('invalid date')
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
  }
}

function absBox({ left, top, width, height, justifyContent = 'flex-start' }) {
  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent,
  }
}

function textNode({ box, text, fontFamily, fontSize, color, letterSpacing }) {
  return {
    type: 'div',
    props: {
      style: {
        ...absBox(box),
        fontFamily,
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        color,
        whiteSpace: 'nowrap',
        ...(letterSpacing ? { letterSpacing: `${letterSpacing}px` } : {}),
      },
      children: text,
    },
  }
}

/**
 * @param {object} params
 * @param {string} params.fullName - winner's full name
 * @param {number} params.amountUsd - whole/decimal USD amount (e.g. 60)
 * @param {string} params.chequeNumber - e.g. "WC-DF6EEF9B"
 * @param {string|Date} [params.dateIso] - when the cheque is dated (defaults to now)
 * @returns {Promise<Buffer>} PNG buffer of the composited cheque, ready to attach to an email
 */
export async function generateWinnerChequePng({ fullName, amountUsd, chequeNumber, dateIso }) {
  const { template, oswaldBold, dmSansBold } = loadAssets()

  const name = String(fullName || '').trim() || 'Winner'
  const amount = Number.isFinite(amountUsd) ? amountUsd : Number(amountUsd) || 0
  const amountLabel = `$${amount.toFixed(2)}`
  const amountWords = numberToUsdWords(amount)
  const dateLabel = formatChequeDate(dateIso)
  const chequeRef = String(chequeNumber || '').trim() || 'WC-00000000'

  const nameFontSize = fitFontSize(name, 50, 26)
  const wordsFontSize = fitFontSize(amountWords, 44, 34)

  const overlaySvg = await satori(
    {
      type: 'div',
      props: {
        style: {
          position: 'relative',
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
          display: 'flex',
        },
        children: [
          // Cheque reference number, centered inside its bordered box
          textNode({
            box: { left: 709, top: 698, width: 581, height: 92, justifyContent: 'center' },
            text: chequeRef,
            fontFamily: 'Oswald',
            fontSize: 54,
            color: GOLD,
            letterSpacing: 6,
          }),
          // Date value
          textNode({
            box: { left: 1438, top: 768, width: 400, height: 58 },
            text: dateLabel,
            fontFamily: 'DM Sans',
            fontSize: 42,
            color: GOLD,
          }),
          // Awarded-to name
          textNode({
            box: { left: 188, top: 858, width: 810, height: 90 },
            text: name,
            fontFamily: 'DM Sans',
            fontSize: nameFontSize,
            color: CREAM,
          }),
          // Amount in words
          textNode({
            box: { left: 189, top: 1030, width: 770, height: 82 },
            text: amountWords,
            fontFamily: 'DM Sans',
            fontSize: wordsFontSize,
            color: CREAM,
          }),
          // USD figure
          textNode({
            box: { left: 1372, top: 915, width: 473, height: 200 },
            text: amountLabel,
            fontFamily: 'Oswald',
            fontSize: 90,
            color: GOLD,
          }),
        ],
      },
    },
    {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fonts: [
        { name: 'Oswald', data: oswaldBold, weight: 700, style: 'normal' },
        { name: 'DM Sans', data: dmSansBold, weight: 700, style: 'normal' },
      ],
    },
  )

  const resvg = new Resvg(overlaySvg, {
    fitTo: { mode: 'width', value: CANVAS_WIDTH },
    background: 'rgba(0,0,0,0)',
  })
  const overlayPng = resvg.render().asPng()

  // sharp applies resize() to the base image before compositing regardless of call order, so
  // resizing in the same chain as composite() would shrink the base below the overlay's size
  // and throw "Image to composite must have same dimensions or smaller". Composite at full
  // resolution first, then resize the finished PNG as a separate step.
  const composited = await sharp(template)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .png()
    .toBuffer()

  return sharp(composited)
    .resize({ width: OUTPUT_WIDTH })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()
}
