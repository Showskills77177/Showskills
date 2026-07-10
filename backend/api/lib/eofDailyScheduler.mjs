/**
 * Daily EOF Short automation:
 * pick European football news → Grok 4.5 script → Build Short → Studio meta (#shortsfeed) → YouTube.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createEofProductionJob, getEofProductionJob, updateEofProductionJob } from './eofProductionJobs.mjs'
import { renderEofProductionFullBuild } from './eofProductionRenderRunner.mjs'
import { ensureEofVideoOnDisk, ensureEofSceneImageOnDisk } from './eofProductionArtifacts.mjs'
import { pickEofDailyNewsTopic } from './eofNewsTopics.mjs'
import { composeEofStudioMeta } from './eofStudioMeta.mjs'
import {
  getEofSchedulerSettings,
  markEofSchedulerRun,
} from './eofSchedulerSettings.mjs'
import { readYoutubeConfig } from './youtubeConfig.mjs'
import { initYoutubeResumableUpload, putYoutubeResumableUpload } from './youtubeUpload.mjs'
import {
  createEofProject,
  completeEofUpload,
  markEofProjectFailed,
  EOF_UPLOAD_SOURCE,
} from './eofYoutubeProjects.mjs'
import { EOF_PRODUCTION_JOB_STATUS } from '../../../shared/eofProduction.mjs'
import { applyShortsDescription } from '../../../shared/eofYoutubeMeta.mjs'

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

/**
 * @param {{ force?: boolean, createdBy?: string }} [opts]
 */
export async function runEofDailyShortPipeline(opts = {}) {
  const force = opts.force === true
  const settings = await getEofSchedulerSettings()

  if (!force && !settings.enabled) {
    return { ok: false, skipped: true, reason: 'Scheduler is disabled.' }
  }

  if (!force && alreadyRanToday(settings.lastRunAt) && settings.lastStatus === 'ok') {
    return { ok: true, skipped: true, reason: 'Already ran successfully today (UTC).' }
  }

  const yt = readYoutubeConfig()
  if (!yt.isReadyToPublish) {
    const msg = 'YouTube is not connected — cannot auto-publish.'
    await markEofSchedulerRun({ status: 'failed', error: msg })
    throw new Error(msg)
  }

  let jobId = null
  let projectId = null

  try {
    const news = await pickEofDailyNewsTopic()
    const format = settings.format || 'news'
    const voicePreset = settings.voicePreset || 'brian'

    const job = await createEofProductionJob({
      topic: news.topic,
      createdBy: opts.createdBy || 'eof-scheduler',
      format,
      voicePreset,
      mode: 'full',
      context: [news.angle, news.whyNow].filter(Boolean).join('\n'),
    })
    jobId = job.id

    // Prefer news format even if create used another default
    if (job.script && job.script.format !== format) {
      await updateEofProductionJob(jobId, {
        script: { ...job.script, format },
      })
    }

    await renderEofProductionFullBuild(jobId)
    const rendered = await getEofProductionJob(jobId)
    if (!rendered || rendered.status !== EOF_PRODUCTION_JOB_STATUS.VIDEO_RENDERED) {
      throw new Error(rendered?.errorMessage || 'Daily Short build did not finish with a video')
    }

    const meta = await composeEofStudioMeta({
      topic: news.topic,
      script: rendered.script,
      format,
    })

    // Persist Studio-ready packaging on the production job
    await updateEofProductionJob(jobId, {
      script: {
        ...rendered.script,
        title: meta.title,
        description: meta.description,
        tags: meta.tags,
      },
      title: meta.title,
      status: EOF_PRODUCTION_JOB_STATUS.VIDEO_RENDERED,
    })

    const videoPath = await ensureEofVideoOnDisk(jobId)
    if (!videoPath || !existsSync(videoPath)) {
      throw new Error('Finished Short video is missing on disk / in storage.')
    }
    const videoBuf = readFileSync(videoPath)

    let thumbnailBase64 = null
    try {
      const still = await ensureEofSceneImageOnDisk(jobId, meta.thumbnailSceneIndex + 1)
      if (still && existsSync(still)) {
        thumbnailBase64 = readFileSync(still).toString('base64')
      }
    } catch {
      /* optional */
    }

    const scheduledAt = new Date(
      Date.now() + Math.max(0, settings.publishDelayMinutes) * 60 * 1000,
    ).toISOString()

    const description = applyShortsDescription(meta.description, {
      isShort: true,
      addShortsHashtag: true,
    })

    const project = await createEofProject({
      title: meta.title,
      description,
      uploadSource: EOF_UPLOAD_SOURCE.ADMIN,
      submittedBy: opts.createdBy || 'eof-scheduler',
      scheduledAt,
      contentType: 'short',
      tags: meta.tags,
      visibility: 'private',
      madeForKids: false,
      categoryId: format === 'news' ? '17' : '17',
      channelId: yt.channelId || null,
      fileSizeBytes: videoBuf.length,
      durationSeconds: null,
      containsSyntheticMedia: true,
      paidPromotion: false,
      widthPixels: 1080,
      heightPixels: 1920,
      aspectRatio: 1080 / 1920,
      isVerticalShort: true,
    })
    projectId = project.id

    const { uploadUrl } = await initYoutubeResumableUpload({
      title: meta.title,
      description,
      tags: meta.tags,
      categoryId: '17',
      privacyStatus: 'private',
      publishAt: scheduledAt,
      contentType: 'video/mp4',
      contentLength: videoBuf.length,
      madeForKids: false,
      containsSyntheticMedia: true,
      paidPromotion: false,
      defaultLanguage: 'en-GB',
    })

    const { youtubeVideoId } = await putYoutubeResumableUpload(uploadUrl, videoBuf, 'video/mp4')

    const completed = await completeEofUpload({
      projectId,
      youtubeVideoId,
      uploadSource: EOF_UPLOAD_SOURCE.ADMIN,
      scheduledAt,
      visibility: 'private',
      thumbnailBase64,
    })

    await updateEofProductionJob(jobId, {
      youtubeProjectId: projectId,
      status: EOF_PRODUCTION_JOB_STATUS.PUBLISHED,
    })

    await markEofSchedulerRun({
      status: 'ok',
      jobId,
      projectId,
      error: null,
    })

    return {
      ok: true,
      skipped: false,
      jobId,
      projectId,
      youtubeVideoId: completed.youtubeVideoId,
      title: meta.title,
      tags: meta.tags,
      scheduledAt,
      news,
      thumbnailSceneIndex: meta.thumbnailSceneIndex,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (projectId) {
      await markEofProjectFailed(projectId, message).catch(() => {})
    }
    await markEofSchedulerRun({
      status: 'failed',
      jobId,
      projectId,
      error: message,
    })
    throw e
  }
}
