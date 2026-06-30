/**
 * Generates translated locale files from shared/i18n/locales/en.mjs
 * Run: node scripts/generate-site-translations.mjs [--locale es] [--dry-run]
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EN_MESSAGES } from '../shared/i18n/locales/en.mjs'
import { SITE_LOCALE_OPTIONS, DEFAULT_SITE_LOCALE } from '../shared/i18n/localeMeta.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../shared/i18n/locales')

const GOOGLE_LANG = {
  zh: 'zh-CN',
}

/** @param {string} locale */
function googleLangCode(locale) {
  return GOOGLE_LANG[locale] || locale
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {string[]} texts
 * @param {string} targetLang
 */
async function translateBatch(texts, targetLang) {
  const tl = googleLangCode(targetLang)
  const params = new URLSearchParams()
  params.set('client', 'gtx')
  params.set('sl', 'en')
  params.set('tl', tl)
  params.set('dt', 't')
  for (const text of texts) params.append('q', text)

  const url = `https://translate.googleapis.com/translate_a/single?${params}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShowSkills-i18n/1.0)' },
  })
  if (!res.ok) throw new Error(`Translate HTTP ${res.status} for ${targetLang}`)
  const data = await res.json()
  if (!Array.isArray(data?.[0])) throw new Error(`Unexpected translate response for ${targetLang}`)
  return data[0].map((segment) => segment[0])
}

/**
 * @param {Record<string, string>} en
 * @param {string} locale
 */
async function translateLocale(en, locale) {
  const keys = Object.keys(en)
  const translated = {}
  const BATCH = 12

  for (let i = 0; i < keys.length; i += BATCH) {
    const batchKeys = keys.slice(i, i + BATCH)
    const batchTexts = batchKeys.map((k) => en[k])
    let results
    let attempts = 0
    while (attempts < 4) {
      try {
        results = await translateBatch(batchTexts, locale)
        break
      } catch (err) {
        attempts += 1
        if (attempts >= 4) throw err
        await sleep(1500 * attempts)
      }
    }
    batchKeys.forEach((key, idx) => {
      translated[key] = results[idx] || en[key]
    })
    process.stdout.write(`\r  ${locale}: ${Math.min(i + BATCH, keys.length)}/${keys.length}`)
    await sleep(350)
  }
  process.stdout.write('\n')
  return translated
}

function serializeLocale(messages, locale) {
  const keys = Object.keys(messages).sort()
  const lines = keys.map((key) => {
    const value = messages[key]
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `  '${key}': '${escaped}',`
  })
  return `/** Auto-generated — node scripts/generate-site-translations.mjs */\n\n/** @type {import('./en.mjs').EN_MESSAGES} */\nconst ${locale.toUpperCase()}_MESSAGES = {\n${lines.join('\n')}\n}\n\nexport default ${locale.toUpperCase()}_MESSAGES\n`
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const localeArg = args.find((a) => a.startsWith('--locale='))?.split('=')[1]
    || (args.includes('--locale') ? args[args.indexOf('--locale') + 1] : null)

  const targets = localeArg
    ? [localeArg]
    : SITE_LOCALE_OPTIONS.map((l) => l.code).filter((c) => c !== DEFAULT_SITE_LOCALE)

  mkdirSync(OUT_DIR, { recursive: true })
  const keyCount = Object.keys(EN_MESSAGES).length
  console.log(`Translating ${keyCount} keys to ${targets.length} locale(s)…`)

  for (const locale of targets) {
    if (locale === DEFAULT_SITE_LOCALE) continue
    const outPath = join(OUT_DIR, `${locale}.mjs`)
    if (!dryRun) {
      console.log(`→ ${locale}`)
      const translated = await translateLocale(EN_MESSAGES, locale)
      writeFileSync(outPath, serializeLocale(translated, locale), 'utf8')
    } else {
      console.log(`(dry-run) would write ${outPath}`)
    }
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
