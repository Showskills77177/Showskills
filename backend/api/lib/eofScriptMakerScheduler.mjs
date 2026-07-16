/**
 * Overnight Script Maker — pick football angles, write judged drafts only.
 * No video render, no YouTube. Owner reviews jobs in Production next day.
 */
import { createEofProductionJob, getEofProductionJob, listEofProductionJobs } from './eofProductionJobs.mjs'
import {
  getEofScriptMakerSettings,
  markEofScriptMakerRun,
} from './eofScriptMakerSettings.mjs'
import { pickEofEuropeanFootballNewsTopics } from './eofNewsTopics.mjs'
import { sourceEofFootballQuote, quoteHitToHeadline } from './eofQuoteSourcing.mjs'
import { EOF_PRODUCTION_JOB_STATUS } from '../../../shared/eofProduction.mjs'

const CREATED_BY = 'eof-script-maker'

function alreadyRanToday(lastRunAt) {
  if (!lastRunAt) return false
  const last = new Date(lastRunAt)
  if (Number.isNaN(last.getTime())) return false
  const now = new Date()
  return (
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth() &&
    last.getUTCDate() === now.getUTCDate()
  )
}

export function topicKey(topic) {
  return String(topic || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/** Pure quota for news vs quote angles in a Script Maker batch. */
export function scriptMakerFormatQuota(count = 5, formatMix = 'mixed') {
  const n = Math.min(12, Math.max(1, Number(count) || 5))
  const mix = ['mixed', 'news', 'quote'].includes(formatMix) ? formatMix : 'mixed'
  const wantQuotes = mix === 'quote' ? n : mix === 'news' ? 0 : Math.max(1, Math.floor(n / 2))
  const wantNews = n - wantQuotes
  return { n, formatMix: mix, wantQuotes, wantNews }
}

/**
 * Build a mixed slate of news + quote angles for tonight's batch.
 * @param {{ count: number, formatMix: string }} opts
 */
export async function pickScriptMakerTopics({ count = 5, formatMix = 'mixed' } = {}) {
  const { n, wantQuotes, wantNews } = scriptMakerFormatQuota(count, formatMix)
  /** @type {Array<{ topic: string, format: string, context: string, source: string, headline: string }>} */
  const out = []

  if (wantNews > 0) {
    try {
      const { topics, source } = await pickEofEuropeanFootballNewsTopics({ count: wantNews + 2 })
      for (const t of topics || []) {
        if (out.length >= wantNews) break
        const headline = String(t.headline || '').trim()
        if (!headline) continue
        out.push({
          topic: headline,
          format: 'news',
          context: [t.angle, t.whyNow, (t.desks || []).join(', ')].filter(Boolean).join('\n'),
          source: source || 'news',
          headline,
        })
      }
    } catch (e) {
      console.warn('[eof-script-maker] news topics failed', e instanceof Error ? e.message : e)
    }
  }

  for (let i = 0; i < wantQuotes && out.length < n; i += 1) {
    try {
      const { quote, source } = await sourceEofFootballQuote({ topic: '', format: 'quote' })
      const headline = quoteHitToHeadline(quote)
      out.push({
        topic: headline,
        format: 'quote',
        context: [
          `${quote.speaker}${quote.role ? ` (${quote.role})` : ''}: "${quote.quote}"`,
          quote.whyItBites || quote.context || '',
          (quote.sources || []).join(', ') || quote.outlet || '',
        ]
          .filter(Boolean)
          .join('\n'),
        source: source || 'quote',
        headline,
      })
    } catch (e) {
      console.warn('[eof-script-maker] quote topic failed', e instanceof Error ? e.message : e)
    }
  }

  // Top up with more news if quotes were thin
  if (out.length < n) {
    try {
      const { topics, source } = await pickEofEuropeanFootballNewsTopics({ count: n - out.length + 2 })
      for (const t of topics || []) {
        if (out.length >= n) break
        const headline = String(t.headline || '').trim()
        if (!headline) continue
        if (out.some((x) => topicKey(x.topic) === topicKey(headline))) continue
        out.push({
          topic: headline,
          format: 'news',
          context: [t.angle, t.whyNow].filter(Boolean).join('\n'),
          source: source || 'news',
          headline,
        })
      }
    } catch {
      /* ignore */
    }
  }

  return out.slice(0, n)
}

/**
 * @param {{ force?: boolean, createdBy?: string }} [opts]
 */
export async function runEofScriptMakerPipeline(opts = {}) {
  const force = opts.force === true
  const settings = await getEofScriptMakerSettings()

  if (!force && !settings.enabled) {
    return { ok: false, skipped: true, reason: 'Script Maker is disabled.' }
  }

  if (!force && alreadyRanToday(settings.lastRunAt) && settings.lastStatus === 'ok') {
    return {
      ok: true,
      skipped: true,
      reason: 'Script Maker already prepared a batch today (UTC).',
      jobIds: settings.lastJobIds,
    }
  }

  const createdBy = opts.createdBy || CREATED_BY
  const existing = await listEofProductionJobs(40)
  const recentKeys = new Set(
    existing
      .filter((j) => j.createdBy === CREATED_BY || String(j.createdBy || '').includes('script-maker'))
      .map((j) => topicKey(j.topic)),
  )

  let topics
  try {
    topics = await pickScriptMakerTopics({
      count: settings.targetCount,
      formatMix: settings.formatMix,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not pick topics'
    await markEofScriptMakerRun({ status: 'failed', error: msg, jobIds: [] })
    throw e
  }

  if (!topics.length) {
    const msg = 'No news/quote angles available for Script Maker.'
    await markEofScriptMakerRun({ status: 'failed', error: msg, jobIds: [] })
    throw new Error(msg)
  }

  const jobs = []
  const errors = []

  for (const item of topics) {
    if (recentKeys.has(topicKey(item.topic))) {
      errors.push(`skip duplicate: ${item.topic.slice(0, 60)}`)
      continue
    }
    try {
      // Draft only + auto writer→judge→escalate (directness gate). No adapt/video/YouTube.
      const job = await createEofProductionJob({
        topic: item.topic,
        createdBy,
        format: item.format,
        mode: 'draft',
        scriptProvider: 'auto',
        context: item.context,
        voicePreset: 'british',
      })
      recentKeys.add(topicKey(item.topic))
      jobs.push({
        id: job.id,
        topic: job.topic,
        title: job.title || job.script?.title || job.topic,
        format: job.script?.format || item.format,
        status: job.status,
        judge: job.script?.judge || null,
        source: job.scriptSource || item.source,
        plainTextDraft: job.script?.plainTextDraft || '',
      })
    } catch (e) {
      errors.push(`${item.topic.slice(0, 40)}: ${e instanceof Error ? e.message : e}`)
      console.warn('[eof-script-maker] job failed', e)
    }
  }

  const jobIds = jobs.map((j) => j.id)
  if (!jobIds.length) {
    const msg = errors[0] || 'Script Maker created zero drafts.'
    await markEofScriptMakerRun({ status: 'failed', error: msg, jobIds: [] })
    throw new Error(msg)
  }

  await markEofScriptMakerRun({
    status: 'ok',
    jobIds,
    error: errors.length ? errors.slice(0, 3).join(' · ') : null,
  })

  return {
    ok: true,
    skipped: false,
    count: jobs.length,
    jobIds,
    jobs,
    errors,
    message: `Prepared ${jobs.length} judged draft script(s) for morning review.`,
  }
}

/** Recent Script Maker drafts for the review UI. */
export async function listEofScriptMakerDrafts(limit = 12) {
  const jobs = await listEofProductionJobs(Math.max(limit * 2, 24))
  return jobs
    .filter(
      (j) =>
        (j.createdBy === CREATED_BY || String(j.createdBy || '').includes('script-maker')) &&
        (j.status === EOF_PRODUCTION_JOB_STATUS.DRAFT ||
          j.status === EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT),
    )
    .slice(0, limit)
    .map((j) => ({
      id: j.id,
      topic: j.topic,
      title: j.title || j.script?.title || j.topic,
      format: j.script?.format || null,
      status: j.status,
      plainTextDraft: j.script?.plainTextDraft || '',
      judge: j.script?.judge || null,
      scriptSource: j.scriptSource || null,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }))
}

export async function getEofScriptMakerDraft(id) {
  const job = await getEofProductionJob(id)
  if (!job) return null
  if (job.createdBy !== CREATED_BY && !String(job.createdBy || '').includes('script-maker')) {
    return null
  }
  return job
}
