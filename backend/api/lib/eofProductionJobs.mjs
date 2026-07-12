import { randomUUID } from 'node:crypto'
import { existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'
import {
  EOF_PRODUCTION_JOB_STATUS,
  EOF_DEFAULT_MUSIC_VOLUME,
  EOF_DEFAULT_VOICE_PRESET,
  EOF_VOICE_PRESETS,
  parseProductionScript,
  parseRenderProgress,
} from '../../../shared/eofProduction.mjs'
import {
  EOF_DEFAULT_CAPTION_STYLE,
  resolveEofCaptionStyle,
} from '../../../shared/eofCaptionStyles.mjs'
import { normalizeElevenLabsVoiceSettings, resolveElevenLabsVoiceSettings } from '../../../shared/eofElevenLabsVoice.mjs'
import { hashEofNarrationLines } from '../../../shared/eofVoiceRegeneration.mjs'
import { pickEofMusicTrackForTopic } from './eofMusicTracks.mjs'
import { eofProductionJobDirPath } from './eofSceneTts.mjs'
import {
  writeEofProductionScript,
  writeEofPlainTextDraft,
  adaptEofPlainTextToScenes,
  buildEofDraftShell,
} from './eofScriptWriter.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Job metadata only — never pull durable media base64 into list/detail payloads. */
const EOF_JOB_SELECT = `id, topic, title, status, script_json, script_source, music_track_id, music_volume,
  voice_preset, voice_settings_json, voice_regeneration_count, voice_narration_hash,
  caption_style, narration_manifest_json, mixed_audio_path, render_output_path,
  youtube_project_id, error_message, render_progress_json, created_by, created_at, updated_at`

function parseVoiceSettingsJson(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return normalizeElevenLabsVoiceSettings(parsed)
  } catch {
    return null
  }
}

function defaultVoiceSettingsForPreset(voicePreset) {
  const preset = EOF_VOICE_PRESETS[voicePreset] || EOF_VOICE_PRESETS[EOF_DEFAULT_VOICE_PRESET]
  if (preset?.engine !== 'elevenlabs') return null
  return resolveElevenLabsVoiceSettings(preset, null)
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

function nowSql() {
  return dbIsPostgres() ? 'now()' : `datetime('now')`
}

function rowToJob(row) {
  if (!row) return null
  return {
    id: row.id,
    topic: row.topic,
    title: row.title || null,
    status: row.status,
    script: parseProductionScript(row.script_json),
    musicTrackId: row.music_track_id || null,
    musicVolume: Number(row.music_volume) || EOF_DEFAULT_MUSIC_VOLUME,
    voicePreset: row.voice_preset || EOF_DEFAULT_VOICE_PRESET,
    voiceSettings: parseVoiceSettingsJson(row.voice_settings_json),
    voiceRegenerationCount: Number(row.voice_regeneration_count) || 0,
    voiceNarrationHash: row.voice_narration_hash || null,
    scriptSource: row.script_source || null,
    captionStyle: resolveEofCaptionStyle(row.caption_style || EOF_DEFAULT_CAPTION_STYLE),
    narrationManifest: (() => {
      if (!row.narration_manifest_json) return null
      try {
        return JSON.parse(row.narration_manifest_json)
      } catch {
        return null
      }
    })(),
    mixedAudioPath: row.mixed_audio_path || null,
    renderOutputPath: row.render_output_path || null,
    youtubeProjectId: row.youtube_project_id || null,
    errorMessage: row.error_message || null,
    renderProgress: parseRenderProgress(row.render_progress_json),
    createdBy: row.created_by || null,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  }
}

export async function listEofProductionJobs(limit = 50) {
  await ensureEofProductionSchema()
  const { rows } = await query(
    `SELECT ${EOF_JOB_SELECT} FROM eof_production_jobs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
  return rows.map(rowToJob)
}

export async function getEofProductionJob(id) {
  await ensureEofProductionSchema()
  const { rows } = await query(`SELECT ${EOF_JOB_SELECT} FROM eof_production_jobs WHERE id = $1`, [id])
  return rowToJob(rows[0])
}

export async function createEofProductionJob({
  topic,
  createdBy,
  voicePreset = EOF_DEFAULT_VOICE_PRESET,
  musicTrackId = null,
  format = null,
  scriptProvider = null,
  captionStyle = EOF_DEFAULT_CAPTION_STYLE,
  /** 'draft' = plain text only · 'full' = draft + adapt (scheduler) */
  mode = 'draft',
  context = null,
}) {
  await ensureEofProductionSchema()
  let t = String(topic || '').trim()
  if (t.length < 2) throw new Error('Topic is required (min 2 characters).')

  const track = await pickEofMusicTrackForTopic(t, musicTrackId)
  const id = randomUUID()
  const preset = EOF_VOICE_PRESETS[voicePreset] || EOF_VOICE_PRESETS[EOF_DEFAULT_VOICE_PRESET]
  const voiceSettings =
    preset?.engine === 'elevenlabs' ? resolveElevenLabsVoiceSettings(preset, null) : null
  const caption = resolveEofCaptionStyle(captionStyle)

  let script
  let scriptSource
  let status
  let failureDetail = ''

  if (mode === 'full') {
    const written = await writeEofProductionScript({ topic: t, format, context, scriptProvider })
    script = written.script
    scriptSource = written.source || 'template'
    status = EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT
    failureDetail = written.failureDetail || ''
    if (written.script?.topic) t = String(written.script.topic).trim() || t
  } else {
    const draft = await writeEofPlainTextDraft({ topic: t, format, context, scriptProvider })
    const resolvedTopic = draft.resolvedTopic || t
    t = resolvedTopic
    script = buildEofDraftShell({
      topic: resolvedTopic,
      format,
      plainTextDraft: draft.plainTextDraft,
      title: draft.title || resolvedTopic,
      source: draft.source,
    })
    scriptSource = draft.source || 'template'
    status = EOF_PRODUCTION_JOB_STATUS.DRAFT
    failureDetail = draft.failureDetail || ''
  }

  await query(
    `INSERT INTO eof_production_jobs
     (id, topic, title, status, script_json, script_source, music_track_id, music_volume, voice_preset, voice_settings_json, caption_style, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      t,
      script.title,
      status,
      JSON.stringify(script),
      scriptSource || 'template',
      track?.id || null,
      EOF_DEFAULT_MUSIC_VOLUME,
      voicePreset,
      voiceSettings ? JSON.stringify(voiceSettings) : null,
      caption,
      createdBy || null,
    ],
  )

  const created = await getEofProductionJob(id)
  return failureDetail ? { ...created, scriptFailureDetail: failureDetail } : created
}

/**
 * Regenerate plain-text draft only (keeps job; clears scenes until Adapt).
 */
export async function regenerateEofProductionDraft(id, { format, context, scriptProvider } = {}) {
  const job = await getEofProductionJob(id)
  if (!job) throw new Error('Production job not found.')
  const fmt = format || job.script?.format || null
  const previousDraft = String(job.script?.plainTextDraft || '').trim()
  const draft = await writeEofPlainTextDraft({
    topic: job.topic,
    format: fmt,
    context,
    scriptProvider,
    regenerate: true,
    previousDraft,
  })
  const resolvedTopic = draft.resolvedTopic || job.topic
  const script = buildEofDraftShell({
    topic: resolvedTopic,
    format: fmt,
    plainTextDraft: draft.plainTextDraft,
    title: draft.title || resolvedTopic,
    source: draft.source,
  })
  const updated = await updateEofProductionJob(id, {
    script,
    title: script.title,
    topic: resolvedTopic,
    scriptSource: draft.source || 'template',
    status: EOF_PRODUCTION_JOB_STATUS.DRAFT,
    errorMessage: null,
    renderOutputPath: null,
    narrationManifest: null,
    mixedAudioPath: null,
    voiceRegenerationCount: 0,
    voiceNarrationHash: null,
  })
  return draft.failureDetail ? { ...updated, scriptFailureDetail: draft.failureDetail } : updated
}

/**
 * Adapt saved plain-text draft into Short scenes.
 */
export async function adaptEofProductionDraftToScenes(id, { format, plainTextDraft, scriptProvider } = {}) {
  const job = await getEofProductionJob(id)
  if (!job) throw new Error('Production job not found.')
  const draft = String(plainTextDraft || job.script?.plainTextDraft || '').trim()
  if (draft.length < 40) {
    throw new Error('Write or generate a plain-text script first (at least a short paragraph).')
  }
  const fmt = format || job.script?.format || null
  const { script, source: scriptSource } = await adaptEofPlainTextToScenes({
    plainTextDraft: draft,
    topic: job.topic,
    format: fmt,
    scriptProvider,
  })
  script.plainTextDraft = draft
  const track = await pickEofMusicTrackForTopic(job.topic, job.musicTrackId)
  return updateEofProductionJob(id, {
    script,
    title: script.title,
    scriptSource,
    musicTrackId: track?.id || job.musicTrackId,
    status: EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT,
    errorMessage: null,
    renderOutputPath: null,
    narrationManifest: null,
    voiceRegenerationCount: 0,
    voiceNarrationHash: null,
  })
}

export async function regenerateEofProductionScript(id, { format, scriptProvider } = {}) {
  const job = await getEofProductionJob(id)
  if (!job) throw new Error('Production job not found.')
  const fmt = format || job.script?.format || null
  const { script, source: scriptSource } = await writeEofProductionScript({
    topic: job.topic,
    format: fmt,
    scriptProvider,
  })
  const track = await pickEofMusicTrackForTopic(job.topic, job.musicTrackId)
  return updateEofProductionJob(id, {
    script,
    title: script.title,
    scriptSource,
    musicTrackId: track?.id || job.musicTrackId,
    status: EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT,
    errorMessage: null,
    renderOutputPath: null,
    narrationManifest: null,
    voiceRegenerationCount: 0,
    voiceNarrationHash: null,
  })
}

export async function updateEofProductionJob(id, patch) {
  await ensureEofProductionSchema()
  const job = await getEofProductionJob(id)
  if (!job) throw new Error('Production job not found.')

  const script = patch.script !== undefined ? patch.script : job.script
  const title = patch.title !== undefined ? patch.title : script?.title || job.title
  const musicTrackId = patch.musicTrackId !== undefined ? patch.musicTrackId : job.musicTrackId
  const musicVolume =
    patch.musicVolume !== undefined ? Number(patch.musicVolume) : job.musicVolume
  const voicePreset = patch.voicePreset !== undefined ? patch.voicePreset : job.voicePreset
  let voiceSettings =
    patch.voiceSettings !== undefined ? patch.voiceSettings : job.voiceSettings
  if (voiceSettings && typeof voiceSettings === 'object') {
    voiceSettings = normalizeElevenLabsVoiceSettings(voiceSettings)
  } else if ((EOF_VOICE_PRESETS[voicePreset] || {}).engine === 'elevenlabs') {
    voiceSettings = defaultVoiceSettingsForPreset(voicePreset)
  } else {
    voiceSettings = null
  }
  const status = patch.status !== undefined ? patch.status : job.status
  const errorMessage = patch.errorMessage !== undefined ? patch.errorMessage : job.errorMessage
  const mixedAudioPath = patch.mixedAudioPath !== undefined ? patch.mixedAudioPath : job.mixedAudioPath
  const narrationManifest =
    patch.narrationManifest !== undefined ? patch.narrationManifest : job.narrationManifest
  const renderOutputPath =
    patch.renderOutputPath !== undefined ? patch.renderOutputPath : job.renderOutputPath
  const scriptSource = patch.scriptSource !== undefined ? patch.scriptSource : job.scriptSource
  const voiceRegenerationCount =
    patch.voiceRegenerationCount !== undefined
      ? Math.max(0, Number(patch.voiceRegenerationCount) || 0)
      : job.voiceRegenerationCount
  const voiceNarrationHash =
    patch.voiceNarrationHash !== undefined ? patch.voiceNarrationHash : job.voiceNarrationHash
  const youtubeProjectId =
    patch.youtubeProjectId !== undefined ? patch.youtubeProjectId : job.youtubeProjectId
  const captionStyle =
    patch.captionStyle !== undefined
      ? resolveEofCaptionStyle(patch.captionStyle)
      : resolveEofCaptionStyle(job.captionStyle)

  await query(
    `UPDATE eof_production_jobs
     SET topic = $2,
         title = $3,
         status = $4,
         script_json = $5,
         script_source = $6,
         music_track_id = $7,
         music_volume = $8,
         voice_preset = $9,
         voice_settings_json = $10,
         error_message = $11,
         mixed_audio_path = $12,
         narration_manifest_json = $13,
         render_output_path = $14,
         voice_regeneration_count = $15,
         voice_narration_hash = $16,
         youtube_project_id = $17,
         caption_style = $18,
         updated_at = ${nowSql()}
     WHERE id = $1`,
    [
      id,
      patch.topic !== undefined ? patch.topic : job.topic,
      title,
      status,
      script ? JSON.stringify(script) : null,
      scriptSource,
      musicTrackId,
      musicVolume,
      voicePreset,
      voiceSettings ? JSON.stringify(voiceSettings) : null,
      errorMessage,
      mixedAudioPath,
      narrationManifest ? JSON.stringify(narrationManifest) : null,
      renderOutputPath,
      voiceRegenerationCount,
      voiceNarrationHash,
      youtubeProjectId,
      captionStyle,
    ],
  )

  return getEofProductionJob(id)
}

export async function markEofProductionJobFailed(id, message) {
  await updateEofProductionRenderProgress(id, null)
  return updateEofProductionJob(id, {
    status: EOF_PRODUCTION_JOB_STATUS.FAILED,
    errorMessage: String(message || 'Failed').slice(0, 500),
  })
}

export async function updateEofProductionRenderProgress(id, progress) {
  await ensureEofProductionSchema()
  await query(
    `UPDATE eof_production_jobs SET render_progress_json = $2, updated_at = ${nowSql()} WHERE id = $1`,
    [id, progress ? JSON.stringify(progress) : null],
  )
}

export function resetEofVoiceRegenerationBaseline(script) {
  return {
    voiceRegenerationCount: 0,
    voiceNarrationHash: hashEofNarrationLines(script),
  }
}

export function incrementEofVoiceRegenerationCount(job) {
  return Math.max(0, Number(job?.voiceRegenerationCount) || 0) + 1
}

function removeEofProductionJobFiles(jobId) {
  const dirs = [
    eofProductionJobDirPath(jobId),
    join(root, 'storage', 'eof', 'jobs', jobId),
  ]
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (e) {
      console.warn('[eof-production] could not remove job files', jobId, e)
    }
  }
}

export async function cancelEofProductionRender(id) {
  const job = await getEofProductionJob(id)
  if (!job) throw new Error('Production job not found.')
  if (job?.status !== 'rendering' && job?.status !== 'rendering_video') return job

  await updateEofProductionRenderProgress(id, null)
  const backStatus = job.mixedAudioPath
    ? EOF_PRODUCTION_JOB_STATUS.RENDERED
    : EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT
  return updateEofProductionJob(id, {
    status: backStatus,
    errorMessage: null,
  })
}

export async function deleteEofProductionJob(id) {
  await ensureEofProductionSchema()
  const job = await getEofProductionJob(id)
  if (!job) return false

  await updateEofProductionRenderProgress(id, null)
  await query(`DELETE FROM eof_production_jobs WHERE id = $1`, [id])
  removeEofProductionJobFiles(id)
  return true
}
