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
import { normalizeElevenLabsVoiceSettings, resolveElevenLabsVoiceSettings } from '../../../shared/eofElevenLabsVoice.mjs'
import { pickEofMusicTrackForTopic } from './eofMusicTracks.mjs'
import { eofProductionJobDirPath } from './eofSceneTts.mjs'
import { writeEofProductionScript } from './eofScriptWriter.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Job metadata only — never pull durable media base64 into list/detail payloads. */
const EOF_JOB_SELECT = `id, topic, title, status, script_json, music_track_id, music_volume,
  voice_preset, voice_settings_json, narration_manifest_json, mixed_audio_path, render_output_path,
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
    voicePreset: row.voice_preset || 'brian',
    voiceSettings: parseVoiceSettingsJson(row.voice_settings_json),
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
}) {
  await ensureEofProductionSchema()
  const t = String(topic || '').trim()
  if (t.length < 2) throw new Error('Topic is required (min 2 characters).')

  const { script } = await writeEofProductionScript({ topic: t, format })
  const track = await pickEofMusicTrackForTopic(t, musicTrackId)
  const id = randomUUID()
  const preset = EOF_VOICE_PRESETS[voicePreset] || EOF_VOICE_PRESETS[EOF_DEFAULT_VOICE_PRESET]
  const voiceSettings =
    preset?.engine === 'elevenlabs' ? resolveElevenLabsVoiceSettings(preset, null) : null

  await query(
    `INSERT INTO eof_production_jobs
     (id, topic, title, status, script_json, music_track_id, music_volume, voice_preset, voice_settings_json, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      t,
      script.title,
      EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT,
      JSON.stringify(script),
      track?.id || null,
      EOF_DEFAULT_MUSIC_VOLUME,
      voicePreset,
      voiceSettings ? JSON.stringify(voiceSettings) : null,
      createdBy || null,
    ],
  )

  return getEofProductionJob(id)
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

  await query(
    `UPDATE eof_production_jobs
     SET topic = $2,
         title = $3,
         status = $4,
         script_json = $5,
         music_track_id = $6,
         music_volume = $7,
         voice_preset = $8,
         voice_settings_json = $9,
         error_message = $10,
         mixed_audio_path = $11,
         narration_manifest_json = $12,
         render_output_path = $13,
         updated_at = ${nowSql()}
     WHERE id = $1`,
    [
      id,
      patch.topic !== undefined ? patch.topic : job.topic,
      title,
      status,
      script ? JSON.stringify(script) : null,
      musicTrackId,
      musicVolume,
      voicePreset,
      voiceSettings ? JSON.stringify(voiceSettings) : null,
      errorMessage,
      mixedAudioPath,
      narrationManifest ? JSON.stringify(narrationManifest) : null,
      renderOutputPath,
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

export async function regenerateEofProductionScript(id, { format } = {}) {
  const job = await getEofProductionJob(id)
  if (!job) throw new Error('Production job not found.')
  const fmt = format || job.script?.format || null
  const { script } = await writeEofProductionScript({ topic: job.topic, format: fmt })
  const track = await pickEofMusicTrackForTopic(job.topic, job.musicTrackId)
  return updateEofProductionJob(id, {
    script,
    title: script.title,
    musicTrackId: track?.id || job.musicTrackId,
    status: EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT,
    errorMessage: null,
    renderOutputPath: null,
    narrationManifest: null,
  })
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
