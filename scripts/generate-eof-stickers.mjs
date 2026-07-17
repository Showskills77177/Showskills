/**
 * Generate original CapCut-style sticker PNGs for EOF Production (no CapCut asset ripping).
 * Run: node scripts/generate-eof-stickers.mjs
 */
import { mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'backend/api/assets/stickers')
const publicDir = join(root, 'public/eof-stickers')
mkdirSync(outDir, { recursive: true })
mkdirSync(publicDir, { recursive: true })

function resolveFfmpeg() {
  try {
    const mod = requireResolveFfmpeg()
    if (mod && existsSync(mod)) return mod
  } catch {
    /* fall through */
  }
  return process.env.FFMPEG_PATH || 'ffmpeg'
}

function requireResolveFfmpeg() {
  // eslint-disable-next-line no-undef
  const p = join(root, 'node_modules/ffmpeg-static/ffmpeg')
  return existsSync(p) ? p : null
}

const ffmpeg = resolveFfmpeg()
const fontCandidates = [
  join(root, 'assets/fonts/EofCaptionBold.ttf'),
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]
const font = fontCandidates.find((p) => existsSync(p)) || ''

function run(args) {
  execFileSync(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] })
}

function escapeDrawtext(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function writePng(name, vf, size = '400x200') {
  const out = join(outDir, name)
  const args = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=black@0.0:s=${size}:d=1,format=rgba`,
    '-frames:v',
    '1',
    '-vf',
    vf,
    out,
  ]
  run(args)
  copyFileSync(out, join(publicDir, name))
  console.log('wrote', name)
}

const fontOpt = font ? `:fontfile=${font.replace(/:/g, '\\:')}` : ''

// Subscribe — YouTube red pill
writePng(
  'subscribe-yt.png',
  [
    'drawbox=x=20:y=40:w=480:h=100:color=0xFF0000@1:t=fill',
    `drawtext=text='${escapeDrawtext('SUBSCRIBE')}':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2${fontOpt}`,
  ].join(','),
  '520x180',
)

// Follow — TikTok-style dark chip with cyan accent bar
writePng(
  'follow-tt.png',
  [
    'drawbox=x=24:y=44:w=420:h=88:color=0x111111@0.92:t=fill',
    'drawbox=x=24:y=44:w=10:h=88:color=0x25F4EE@1:t=fill',
    `drawtext=text='${escapeDrawtext('Follow')}':fontsize=48:fontcolor=white:x=56:y=(h-text_h)/2${fontOpt}`,
  ].join(','),
  '480x176',
)

// Arrows — filled triangles via geq on transparent canvas
function arrowVf(direction) {
  // White chevron-ish triangle using geq
  const expr = {
    right: "if(gt(X\\,W*0.22)*lt(X\\,W*0.78)*lt(abs(Y-H/2)\\,(X-W*0.22)*0.55)\\,255\\,0)",
    left: "if(gt(X\\,W*0.22)*lt(X\\,W*0.78)*lt(abs(Y-H/2)\\,(W*0.78-X)*0.55)\\,255\\,0)",
    up: "if(gt(Y\\,H*0.22)*lt(Y\\,H*0.78)*lt(abs(X-W/2)\\,(Y-H*0.22)*0.55)\\,255\\,0)",
    down: "if(gt(Y\\,H*0.22)*lt(Y\\,H*0.78)*lt(abs(X-W/2)\\,(H*0.78-Y)*0.55)\\,255\\,0)",
  }[direction]
  return `format=rgba,geq=r='${expr}':g='${expr}':b='${expr}':a='${expr}'`
}

for (const dir of ['left', 'right', 'up', 'down']) {
  writePng(`arrow-${dir}.png`, arrowVf(dir), '240x240')
}

// Shapes
writePng(
  'shape-square.png',
  'drawbox=x=40:y=40:w=200:h=200:color=white@0.95:t=fill',
  '280x280',
)
writePng(
  'shape-square-outline.png',
  'drawbox=x=40:y=40:w=200:h=200:color=white@1:t=14',
  '280x280',
)
writePng(
  'shape-circle.png',
  "format=rgba,geq=r='if(lte(hypot(X-W/2\\,Y-H/2)\\,W*0.38)\\,255\\,0)':g='if(lte(hypot(X-W/2\\,Y-H/2)\\,W*0.38)\\,255\\,0)':b='if(lte(hypot(X-W/2\\,Y-H/2)\\,W*0.38)\\,255\\,0)':a='if(lte(hypot(X-W/2\\,Y-H/2)\\,W*0.38)\\,255\\,0)'",
  '280x280',
)
writePng(
  'shape-circle-outline.png',
  "format=rgba,geq=r='if(between(hypot(X-W/2\\,Y-H/2)\\,W*0.30\\,W*0.38)\\,255\\,0)':g='if(between(hypot(X-W/2\\,Y-H/2)\\,W*0.30\\,W*0.38)\\,255\\,0)':b='if(between(hypot(X-W/2\\,Y-H/2)\\,W*0.30\\,W*0.38)\\,255\\,0)':a='if(between(hypot(X-W/2\\,Y-H/2)\\,W*0.30\\,W*0.38)\\,255\\,0)'",
  '280x280',
)
writePng(
  'shape-rounded.png',
  'drawbox=x=20:y=60:w=400:h=120:color=white@0.9:t=fill',
  '440x240',
)
writePng(
  'shape-line.png',
  'drawbox=x=20:y=70:w=440:h=16:color=0xFFE566@0.95:t=fill',
  '480x160',
)

// Fire accent — stacked orange/yellow triangles
writePng(
  'fire-accent.png',
  [
    "format=rgba,geq=r='if(lte(hypot(X-W/2\\,Y-H*0.55)\\,W*0.28)*gt(Y\\,H*0.28)\\,255\\,if(lte(hypot(X-W/2\\,Y-H*0.42)\\,W*0.18)*gt(Y\\,H*0.18)\\,255\\,0))':g='if(lte(hypot(X-W/2\\,Y-H*0.55)\\,W*0.28)*gt(Y\\,H*0.28)\\,90\\,if(lte(hypot(X-W/2\\,Y-H*0.42)\\,W*0.18)*gt(Y\\,H*0.18)\\,180\\,0))':b='0':a='if(lte(hypot(X-W/2\\,Y-H*0.55)\\,W*0.28)*gt(Y\\,H*0.28)\\,255\\,if(lte(hypot(X-W/2\\,Y-H*0.42)\\,W*0.18)*gt(Y\\,H*0.18)\\,255\\,0))'",
  ].join(','),
  '220x260',
)

// NEW badge
writePng(
  'badge-new.png',
  [
    'drawbox=x=16:y=40:w=280:h=100:color=0x111111@0.92:t=fill',
    'drawbox=x=16:y=40:w=280:h=100:color=0xFFE566@1:t=8',
    `drawtext=text='${escapeDrawtext('NEW')}':fontsize=56:fontcolor=0xFFE566:x=(w-text_w)/2:y=(h-text_h)/2${fontOpt}`,
  ].join(','),
  '312x180',
)

// Tap hand — simple pointer (circle + stem)
writePng(
  'tap-hand.png',
  [
    "format=rgba,geq=r='if(lte(hypot(X-W*0.42\\,Y-H*0.32)\\,W*0.16)\\,255\\,if(gt(X\\,W*0.34)*lt(X\\,W*0.50)*gt(Y\\,H*0.32)*lt(Y\\,H*0.78)\\,255\\,0))':g='if(lte(hypot(X-W*0.42\\,Y-H*0.32)\\,W*0.16)\\,255\\,if(gt(X\\,W*0.34)*lt(X\\,W*0.50)*gt(Y\\,H*0.32)*lt(Y\\,H*0.78)\\,255\\,0))':b='if(lte(hypot(X-W*0.42\\,Y-H*0.32)\\,W*0.16)\\,255\\,if(gt(X\\,W*0.34)*lt(X\\,W*0.50)*gt(Y\\,H*0.32)*lt(Y\\,H*0.78)\\,255\\,0))':a='if(lte(hypot(X-W*0.42\\,Y-H*0.32)\\,W*0.16)\\,230\\,if(gt(X\\,W*0.34)*lt(X\\,W*0.50)*gt(Y\\,H*0.32)*lt(Y\\,H*0.78)\\,230\\,0))'",
  ].join(','),
  '220x280',
)

console.log('EOF stickers written to', outDir, 'and', publicDir)
