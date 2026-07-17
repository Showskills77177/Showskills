import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, requireEofOwner, eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import {
  getEofSchedulerSettings,
  updateEofSchedulerSettings,
} from '../lib/eofSchedulerSettings.mjs'
import { EOF_SCRIPT_FORMATS } from '../../../shared/eofScriptTemplates.mjs'
import { EOF_VOICE_PRESETS, listEofFreeVoicePresets } from '../../../shared/eofProduction.mjs'
import { isLondonLocalMidnightHour } from '../../../shared/eofScriptMakerSchedule.mjs'

function authorizeCron(req) {
  const cronSecret = (process.env.CRON_SECRET || process.env.EOF_CRON_SECRET || '').trim()
  const auth = String(req.headers?.authorization || '')
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (cronSecret && bearer && bearer === cronSecret) return true
  // Vercel Cron sends this header on scheduled invocations
  if (String(req.headers?.['x-vercel-cron'] || '') === '1') return true
  const ua = String(req.headers?.['user-agent'] || '')
  if (/vercel-cron/i.test(ua)) return true
  return false
}

async function runPipeline(opts) {
  const { runEofDailyShortPipeline } = await import('../lib/eofDailyScheduler.mjs')
  return runEofDailyShortPipeline(opts)
}

async function runScriptMaker(opts) {
  const { runEofScriptMakerPipeline } = await import('../lib/eofScriptMakerScheduler.mjs')
  return runEofScriptMakerPipeline(opts)
}

/** Hobby allows ≤2 once-daily crons: 09:00 UTC (daily Short) + 23:00 UTC (BST UK midnight). */
async function runCronJobs() {
  const daily = runPipeline({ force: false, createdBy: 'vercel-cron' }).catch((e) => {
    console.error('[eof-scheduler] cron failed', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  })
  if (!isLondonLocalMidnightHour(new Date())) {
    return { daily: await daily, scriptMaker: { ok: true, skipped: true, reason: 'Not UK midnight' } }
  }
  const scriptMaker = runScriptMaker({ force: false, createdBy: 'eof-script-maker' }).catch((e) => {
    console.error('[eof-script-maker] cron failed', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  })
  const [dailyResult, scriptMakerResult] = await Promise.all([daily, scriptMaker])
  return { daily: dailyResult, scriptMaker: scriptMakerResult }
}

/** GET settings · POST update / run-now / news-topics · Cron GET/POST run */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(204).end()
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Eyes Of Football scheduler is only available on staging.' })
  }

  const isCron = authorizeCron(req)

  try {
    if (isCron && (req.method === 'GET' || req.method === 'POST')) {
      if (process.env.VERCEL) {
        try {
          const { waitUntil } = await import('@vercel/functions')
          waitUntil(runCronJobs())
          return json(res, 202, {
            ok: true,
            accepted: true,
            message: 'Daily Short cron accepted (Script Maker runs when UK midnight).',
            scriptMakerEligible: isLondonLocalMidnightHour(new Date()),
          })
        } catch {
          /* fall through */
        }
      }
      const result = await runCronJobs()
      return json(res, 200, { ok: true, ...result })
    }

    if (req.method === 'GET') {
      try {
        await requireEofSession(req)
      } catch (e) {
        return json(res, e.statusCode || 401, { error: 'Unauthorized' })
      }
      const settings = await getEofSchedulerSettings()
      return json(res, 200, {
        ok: true,
        settings,
        formats: EOF_SCRIPT_FORMATS,
        voicePresets: Object.values(EOF_VOICE_PRESETS),
        freeVoicePresets: listEofFreeVoicePresets(),
        note:
          'Daily cron (09:00 UTC) composes a football news Short with Grok 4.5, builds it, packages #shortsfeed hashtags, picks a thumbnail scene, and schedules it on YouTube. The same Hobby cron path also fires at 23:00 UTC and runs Script Maker when Europe/London is midnight (BST).',
      })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const action = typeof body.action === 'string' ? body.action : 'update'

      if (action === 'run-now' || action === 'run') {
        try {
          await requireEofOwner(req)
        } catch (e) {
          return json(res, e.statusCode || 403, { error: 'Only the channel owner can run the scheduler.' })
        }
        const session = await requireEofSession(req)
        const info = eofSessionInfo(session)
        const result = await runPipeline({
          force: true,
          createdBy: info.username || 'eof-owner',
        })
        return json(res, 200, { ok: true, ...result })
      }

      try {
        await requireEofOwner(req)
      } catch (e) {
        return json(res, e.statusCode || 403, { error: 'Only the channel owner can change the scheduler.' })
      }

      if (action === 'news-topics') {
        const { pickEofEuropeanFootballNewsTopics } = await import('../lib/eofNewsTopics.mjs')
        const topics = await pickEofEuropeanFootballNewsTopics({ count: Number(body.count) || 5 })
        return json(res, 200, { ok: true, ...topics })
      }

      if (action === 'quote-topics') {
        const { sourceEofFootballQuote, quoteHitToHeadline } = await import('../lib/eofQuoteSourcing.mjs')
        const count = Math.min(5, Math.max(1, Number(body.count) || 3))
        const topics = []
        for (let i = 0; i < count; i++) {
          const { quote, source } = await sourceEofFootballQuote({
            topic: typeof body.topic === 'string' ? body.topic : '',
            format: 'quote',
          })
          topics.push({
            headline: quoteHitToHeadline(quote),
            angle: `${quote.speaker}${quote.role ? ` (${quote.role})` : ''}: "${quote.quote}"`,
            desks: quote.sources?.length ? quote.sources : [quote.outlet].filter(Boolean),
            whyNow: quote.whyItBites || quote.context || '',
            quote,
            source,
          })
        }
        return json(res, 200, { ok: true, topics, source: topics[0]?.source || 'template' })
      }

      const settings = await updateEofSchedulerSettings({
        enabled: body.enabled,
        hourUtc: body.hourUtc,
        minuteUtc: body.minuteUtc,
        format: body.format,
        voicePreset: body.voicePreset,
        publishDelayMinutes: body.publishDelayMinutes,
      })
      return json(res, 200, { ok: true, settings })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[eof-scheduler]', e)
    return json(res, 500, { error: e instanceof Error ? e.message : 'Scheduler error' })
  }
}
