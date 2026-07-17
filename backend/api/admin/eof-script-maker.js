import { json, readJsonBody } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession, requireEofOwner, eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import {
  getEofScriptMakerSettings,
  updateEofScriptMakerSettings,
} from '../lib/eofScriptMakerSettings.mjs'
import {
  runEofScriptMakerPipeline,
  listEofScriptMakerDrafts,
  pickScriptMakerTopics,
} from '../lib/eofScriptMakerScheduler.mjs'
import { isLondonLocalMidnightHour } from '../../../shared/eofScriptMakerSchedule.mjs'

function authorizeCron(req) {
  const cronSecret = (process.env.CRON_SECRET || process.env.EOF_CRON_SECRET || '').trim()
  const auth = String(req.headers?.authorization || '')
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (cronSecret && bearer && bearer === cronSecret) return true
  if (String(req.headers?.['x-vercel-cron'] || '') === '1') return true
  const ua = String(req.headers?.['user-agent'] || '')
  if (/vercel-cron/i.test(ua)) return true
  return false
}

/** GET settings + prepared drafts · POST update / run-now / preview-topics · Cron run */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(204).end()
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Script Maker is only available on staging.' })
  }

  const isCron = authorizeCron(req)

  try {
    if (isCron && (req.method === 'GET' || req.method === 'POST')) {
      // Standalone cron path still gates on UK midnight (Hobby schedule lives on eof-daily-cron).
      if (!isLondonLocalMidnightHour(new Date())) {
        return json(res, 200, {
          ok: true,
          skipped: true,
          reason:
            'Not UK midnight (Europe/London). Staging cron fires /api/eof-daily-cron at 23:00 UTC (BST midnight); only the local-midnight window runs Script Maker.',
        })
      }
      if (process.env.VERCEL) {
        try {
          const { waitUntil } = await import('@vercel/functions')
          waitUntil(
            runEofScriptMakerPipeline({ force: false, createdBy: 'eof-script-maker' }).catch((e) =>
              console.error('[eof-script-maker] cron failed', e),
            ),
          )
          return json(res, 202, {
            ok: true,
            accepted: true,
            message: 'Script Maker UK-midnight batch started.',
          })
        } catch {
          /* fall through */
        }
      }
      const result = await runEofScriptMakerPipeline({ force: false, createdBy: 'eof-script-maker' })
      return json(res, 200, { ok: true, ...result })
    }

    if (req.method === 'GET') {
      try {
        await requireEofSession(req)
      } catch (e) {
        return json(res, e.statusCode || 401, { error: 'Unauthorized' })
      }
      const settings = await getEofScriptMakerSettings()
      const drafts = await listEofScriptMakerDrafts(12)
      return json(res, 200, {
        ok: true,
        settings,
        drafts,
        note:
          'Script Maker writes judged draft voiceovers at UK midnight (Europe/London; no video, no YouTube). Drafts are ready when you wake up — Adapt / Rebuild / post yourself.',
        scheduleNote:
          'Runs at UK midnight via /api/eof-daily-cron (Hobby: ≤2 once-daily jobs). Second slot is 23:00 UTC for BST; swap to 00:00 UTC for GMT winters. Handler only proceeds during Europe/London 00:00 hour.',
      })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const action = typeof body.action === 'string' ? body.action : 'update'

      if (action === 'run-now' || action === 'run') {
        try {
          await requireEofOwner(req)
        } catch (e) {
          return json(res, e.statusCode || 403, { error: 'Only the channel owner can run Script Maker.' })
        }
        const session = await requireEofSession(req)
        const info = eofSessionInfo(session)
        const result = await runEofScriptMakerPipeline({
          force: true,
          createdBy: info.username ? `eof-script-maker:${info.username}` : 'eof-script-maker',
        })
        return json(res, 200, { ok: true, ...result })
      }

      try {
        await requireEofOwner(req)
      } catch (e) {
        return json(res, e.statusCode || 403, { error: 'Only the channel owner can change Script Maker.' })
      }

      if (action === 'preview-topics') {
        const settings = await getEofScriptMakerSettings()
        const topics = await pickScriptMakerTopics({
          count: Number(body.count) || settings.targetCount || 5,
          formatMix: typeof body.formatMix === 'string' ? body.formatMix : settings.formatMix,
        })
        return json(res, 200, { ok: true, topics })
      }

      if (action === 'list-drafts') {
        const drafts = await listEofScriptMakerDrafts(Number(body.limit) || 12)
        return json(res, 200, { ok: true, drafts })
      }

      const settings = await updateEofScriptMakerSettings({
        enabled: body.enabled,
        hourUtc: body.hourUtc,
        minuteUtc: body.minuteUtc,
        targetCount: body.targetCount,
        formatMix: body.formatMix,
      })
      return json(res, 200, { ok: true, settings })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[eof-script-maker]', e)
    return json(res, 500, { error: e instanceof Error ? e.message : 'Script Maker error' })
  }
}
