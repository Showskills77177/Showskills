/**
 * Overnight Script Maker — pick football angles, write judged drafts only.
 * No video render, no YouTube. Owner reviews jobs in Production next day.
 */
import {
  createEofProductionJob,
  deleteEofProductionJob,
  getEofProductionJob,
  listEofProductionJobs,
  updateEofProductionJob,
} from './eofProductionJobs.mjs'
import {
  getEofScriptMakerSettings,
  markEofScriptMakerRun,
} from './eofScriptMakerSettings.mjs'
import { pickEofEuropeanFootballNewsTopics } from './eofNewsTopics.mjs'
import { sourceEofFootballQuote, quoteHitToHeadline } from './eofQuoteSourcing.mjs'
import { EOF_PRODUCTION_JOB_STATUS } from '../../../shared/eofProduction.mjs'
import { sameLondonCalendarDay } from '../../../shared/eofScriptMakerSchedule.mjs'

const CREATED_BY = 'eof-script-maker'

/** Default days to keep unused Script Maker drafts before nightly cleanup. */
export const EOF_SCRIPT_RETENTION_DAYS_DEFAULT = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Statuses that are still "unused drafts" — safe to purge when stale. */
const SCRIPT_MAKER_DELETABLE_STATUSES = new Set([
  EOF_PRODUCTION_JOB_STATUS.DRAFT,
  EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT,
  EOF_PRODUCTION_JOB_STATUS.FAILED,
  EOF_PRODUCTION_JOB_STATUS.SCRIPTING,
])

function alreadyRanToday(lastRunAt) {
  if (!lastRunAt) return false
  return sameLondonCalendarDay(lastRunAt, new Date())
}

/**
 * Read retention window from EOF_SCRIPT_RETENTION_DAYS (1–90). Default 7.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getEofScriptRetentionDays(env = process.env) {
  const raw = Number(env?.EOF_SCRIPT_RETENTION_DAYS)
  if (!Number.isFinite(raw) || raw <= 0) return EOF_SCRIPT_RETENTION_DAYS_DEFAULT
  return Math.min(90, Math.max(1, Math.floor(raw)))
}

export function isEofScriptMakerCreatedBy(createdBy) {
  const s = String(createdBy || '')
  return s === CREATED_BY || s.includes('script-maker')
}

/**
 * Pure retention decision: unused Script Maker drafts older than N days.
 * Never deletes published/uploaded Shorts, rendering jobs, built video, or owner-approved drafts.
 *
 * @param {{ createdBy?: string|null, status?: string, createdAt?: string|null, youtubeProjectId?: string|null, script?: { scriptMakerApproved?: boolean }|null }} job
 * @param {{ now?: number|Date, retentionDays?: number }} [opts]
 */
export function isEofScriptMakerJobDeletable(job, opts = {}) {
  if (!job || !isEofScriptMakerCreatedBy(job.createdBy)) return false
  if (job.youtubeProjectId) return false
  if (job.script?.scriptMakerApproved) return false

  const status = String(job.status || '')
  if (!SCRIPT_MAKER_DELETABLE_STATUSES.has(status)) return false

  const retentionDays = Math.max(1, Number(opts.retentionDays) || getEofScriptRetentionDays())
  const nowMs =
    opts.now instanceof Date
      ? opts.now.getTime()
      : Number.isFinite(opts.now)
        ? Number(opts.now)
        : Date.now()
  const createdMs = job.createdAt ? Date.parse(String(job.createdAt)) : NaN
  if (!Number.isFinite(createdMs)) return false
  return nowMs - createdMs >= retentionDays * MS_PER_DAY
}

/**
 * Delete stale unused Script Maker jobs (nightly retention).
 * @param {{ retentionDays?: number, limit?: number, now?: number|Date }} [opts]
 * @returns {Promise<{ retentionDays: number, scanned: number, deletedIds: string[] }>}
 */
export async function cleanupExpiredEofScriptMakerJobs(opts = {}) {
  const retentionDays =
    opts.retentionDays !== undefined
      ? Math.max(1, Math.min(90, Math.floor(Number(opts.retentionDays) || EOF_SCRIPT_RETENTION_DAYS_DEFAULT)))
      : getEofScriptRetentionDays()
  const limit = Math.min(200, Math.max(40, Number(opts.limit) || 120))
  const jobs = await listEofProductionJobs(limit)
  const deletedIds = []
  for (const job of jobs) {
    if (!isEofScriptMakerJobDeletable(job, { retentionDays, now: opts.now })) continue
    try {
      const ok = await deleteEofProductionJob(job.id)
      if (ok) {
        deletedIds.push(job.id)
        console.info(
          `[eof-script-maker] retention deleted job=${job.id} age>=${retentionDays}d status=${job.status}`,
        )
      }
    } catch (e) {
      console.warn(
        `[eof-script-maker] retention delete failed job=${job.id}`,
        e instanceof Error ? e.message : e,
      )
    }
  }
  return { retentionDays, scanned: jobs.length, deletedIds }
}

export function topicKey(topic) {
  return String(topic || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/** Pure quota for news vs quote / debate hot-take angles in a Script Maker batch. */
export function scriptMakerFormatQuota(count = 5, formatMix = 'mixed') {
  const n = Math.min(12, Math.max(1, Number(count) || 5))
  const mix = ['mixed', 'news', 'quote', 'debate'].includes(formatMix) ? formatMix : 'mixed'
  // Mixed = hot-take heavy: ~half quote rows, rest news written as debate takes.
  const wantQuotes =
    mix === 'quote'
      ? n
      : mix === 'news' || mix === 'debate'
        ? 0
        : Math.min(n, Math.max(1, Math.ceil(n / 2)))
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
          // News angles become debate-format hot takes (not wire rewrites).
          format: formatMix === 'news' ? 'news' : 'debate',
          context: [
            'HOT TAKE BRIEF — write a sharp desk argument, not an article paste.',
            t.angle,
            t.whyNow,
            (t.desks || []).join(', '),
          ]
            .filter(Boolean)
            .join('\n'),
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
          format: formatMix === 'news' ? 'news' : 'debate',
          context: [
            'HOT TAKE BRIEF — write a sharp desk argument, not an article paste.',
            t.angle,
            t.whyNow,
          ]
            .filter(Boolean)
            .join('\n'),
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
 * @param {{ force?: boolean, createdBy?: string, skipCleanup?: boolean }} [opts]
 */
export async function runEofScriptMakerPipeline(opts = {}) {
  const force = opts.force === true

  /** Always sweep stale drafts on cron/run (even when disabled / already ran). */
  let cleanup = {
    retentionDays: getEofScriptRetentionDays(),
    scanned: 0,
    deletedIds: [],
  }
  if (opts.skipCleanup !== true) {
    try {
      cleanup = await cleanupExpiredEofScriptMakerJobs()
    } catch (e) {
      console.warn(
        '[eof-script-maker] retention cleanup failed',
        e instanceof Error ? e.message : e,
      )
    }
  }

  const settings = await getEofScriptMakerSettings()

  if (!force && !settings.enabled) {
    return {
      ok: false,
      skipped: true,
      reason: 'Script Maker is disabled.',
      cleanup,
    }
  }

  if (!force && alreadyRanToday(settings.lastRunAt) && settings.lastStatus === 'ok') {
    return {
      ok: true,
      skipped: true,
      reason: 'Script Maker already prepared a batch today (UK calendar day).',
      jobIds: settings.lastJobIds,
      cleanup,
    }
  }

  const createdBy = opts.createdBy || CREATED_BY
  const existing = await listEofProductionJobs(40)
  const recentKeys = new Set(
    existing.filter((j) => isEofScriptMakerCreatedBy(j.createdBy)).map((j) => topicKey(j.topic)),
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
      // Draft only + auto writer→polish→hot-take refine→judge→escalate. No adapt/video/YouTube.
      // qualityBar=production refuses canned templates and soft article paste.
      const job = await createEofProductionJob({
        topic: item.topic,
        createdBy,
        format: item.format,
        mode: 'draft',
        scriptProvider: 'auto',
        context: item.context,
        voicePreset: 'british',
        qualityBar: 'production',
      })
      if (job.scriptSource === 'template') {
        throw new Error('Refused template fallback — not production quality')
      }
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
        stages: job.script?.stages || null,
        qualityBar: job.script?.qualityBar || 'production',
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
    cleanup,
    message: `Prepared ${jobs.length} judged draft script(s) for morning review.`,
  }
}

/** Recent Script Maker drafts for the review UI. */
export async function listEofScriptMakerDrafts(limit = 12) {
  const jobs = await listEofProductionJobs(Math.max(limit * 2, 24))
  return jobs
    .filter(
      (j) =>
        isEofScriptMakerCreatedBy(j.createdBy) &&
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
      source: j.scriptSource || j.script?.draftSource || null,
      stages: j.script?.stages || null,
      qualityBar: j.script?.qualityBar || null,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }))
}

export async function getEofScriptMakerDraft(id) {
  const job = await getEofProductionJob(id)
  if (!job) return null
  if (!isEofScriptMakerCreatedBy(job.createdBy)) {
    return null
  }
  return job
}

/**
 * Approve / open a Script Maker draft in Production so the owner can Adapt + Build.
 * Drafts are already eof_production_jobs rows — this validates the script and marks approval.
 *
 * @param {string} draftId
 * @param {{ approvedBy?: string }} [opts]
 */
export async function openScriptMakerDraftToProduction(draftId, opts = {}) {
  const id = String(draftId || '').trim()
  if (!id) {
    const err = new Error('draftId is required.')
    err.statusCode = 400
    throw err
  }

  const job = await getEofScriptMakerDraft(id)
  if (!job) {
    const err = new Error('Script Maker draft not found (or not a Script Maker job).')
    err.statusCode = 404
    throw err
  }

  const plain = String(job.script?.plainTextDraft || '').trim()
  if (plain.length < 40) {
    const err = new Error('This draft has no usable script text yet — regenerate it first.')
    err.statusCode = 400
    throw err
  }

  const approvedAt = new Date().toISOString()
  const approvedBy = String(opts.approvedBy || '').trim() || null
  const nextScript = {
    ...job.script,
    plainTextDraft: plain,
    scriptMakerApproved: true,
    scriptMakerApprovedAt: approvedAt,
    ...(approvedBy ? { scriptMakerApprovedBy: approvedBy } : {}),
  }

  const updated = await updateEofProductionJob(id, {
    script: nextScript,
    title: job.title || job.script?.title || job.topic,
    // Keep draft / ready_script — do not auto-adapt (owner builds in Production).
    status: job.status,
  })

  return {
    ok: true,
    jobId: updated.id,
    job: updated,
    plainTextDraft: plain,
    status: updated.status,
    alreadyProduction: true,
    message:
      'Opened in Production with the full Script Maker voiceover. Use Adapt from script, then Build.',
  }
}
