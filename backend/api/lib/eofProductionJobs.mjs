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
  normalizeZapcapTemplateId,
  isZapcapCaptionStyle,
} from '../../../shared/eofCaptionStyles.mjs'
import { normalizeEofCaptionLayout } from '../../../shared/eofCaptionLayout.mjs'
import {
  EOF_DEFAULT_TRANSITION_STYLE,
  EOF_DEFAULT_COLOR_GRADE,
  EOF_DEFAULT_ENHANCE_STYLE,
  resolveEofTransitionStyle,
  resolveEofColorGrade,
  resolveEofEnhanceStyle,
} from '../../../shared/eofVideoLook.mjs'
import {
  EOF_DEFAULT_OVERLAY_MOMENTS,
  resolveEofOverlayMoments,
} from '../../../shared/eofOverlayMoments.mjs'
import {
  EOF_DEFAULT_VIDEO_EFFECTS,
  normalizeEofVideoEffects,
} from '../../../shared/eofVideoEffects.mjs'
import {
  EOF_DEFAULT_STICKERS,
  normalizeEofStickers,
} from '../../../shared/eofStickersElements.mjs'
import { normalizeElevenLabsVoiceSettings, resolveElevenLabsVoiceSettings } from '../../../shared/eofElevenLabsVoice.mjs'
import { hashEofNarrationLines } from '../../../shared/eofVoiceRegeneration.mjs'
import { isEofSlimBuildEnabled } from './eofBuildModeSettings.mjs'
import { pickEofMusicTrackForTopic } from './eofMusicTracks.mjs'
import { normalizeEofMusicTrim } from '../../../shared/eofMusicTrim.mjs'
import { parseEofQualityGate, parseEofQualityGateHistory } from './eofShortQualityGate.mjs'
import { eofProductionJobDirPath } from './eofProductionPaths.mjs'
import {
  writeEofProductionScript,
  writeEofPlainTextDraft,
  adaptEofPlainTextToScenes,
  buildEofDraftShell,
} from './eofScriptWriter.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Job metadata only — never pull durable media base64 into list/detail payloads. */
const EOF_JOB_SELECT = `id, topic, title, status, script_json, script_source, music_track_id, music_volume,
  music_start_sec, music_end_sec,
  voice_preset, voice_settings_json, voice_regeneration_count, voice_narration_hash,
  tts_audio_hash, tts_synth_count,
  caption_style, caption_engine, caption_layout_json, zapcap_template_id, transition_style, color_grade, enhance_style,
  overlay_moments, video_effects_json, stickers_json, quality_gate_json, quality_gate_history_json,
  video_footage_mode,
  narration_manifest_json, mixed_audio_path, render_output_path,
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
    musicStartSec:
      row.music_start_sec != null && Number.isFinite(Number(row.music_start_sec))
        ? Number(row.music_start_sec)
        : 0,
    musicEndSec:
      row.music_end_sec != null && Number.isFinite(Number(row.music_end_sec))
        ? Number(row.music_end_sec)
        : null,
    voicePreset: row.voice_preset || EOF_DEFAULT_VOICE_PRESET,
    voiceSettings: parseVoiceSettingsJson(row.voice_settings_json),
    voiceRegenerationCount: Number(row.voice_regeneration_count) || 0,
    voiceNarrationHash: row.voice_narration_hash || null,
    ttsAudioHash: row.tts_audio_hash || null,
    ttsSynthCount: Math.max(0, Number(row.tts_synth_count) || 0),
    scriptSource: row.script_source || null,
    captionStyle: resolveEofCaptionStyle(row.caption_style || EOF_DEFAULT_CAPTION_STYLE),
    captionEngine: row.caption_engine || null,
    captionLayout: (() => {
      const style = resolveEofCaptionStyle(row.caption_style || EOF_DEFAULT_CAPTION_STYLE)
      if (!row.caption_layout_json) return normalizeEofCaptionLayout(null, style)
      try {
        return normalizeEofCaptionLayout(JSON.parse(row.caption_layout_json), style)
      } catch {
        return normalizeEofCaptionLayout(null, style)
      }
    })(),
    zapcapTemplateId: row.zapcap_template_id || null,
    transitionStyle: resolveEofTransitionStyle(row.transition_style || EOF_DEFAULT_TRANSITION_STYLE),
    colorGrade: resolveEofColorGrade(row.color_grade || EOF_DEFAULT_COLOR_GRADE),
    enhanceStyle: resolveEofEnhanceStyle(row.enhance_style || EOF_DEFAULT_ENHANCE_STYLE),
    overlayMoments: resolveEofOverlayMoments(row.overlay_moments || EOF_DEFAULT_OVERLAY_MOMENTS),
    videoEffects: normalizeEofVideoEffects(row.video_effects_json || EOF_DEFAULT_VIDEO_EFFECTS),
    stickers: normalizeEofStickers(row.stickers_json || EOF_DEFAULT_STICKERS),
    qualityGate: parseEofQualityGate(row.quality_gate_json),
    qualityGateHistory: parseEofQualityGateHistory(row.quality_gate_history_json),
    videoFootageMode: row.video_footage_mode === 'auto' ? 'auto' : 'off',
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
  zapcapTemplateId = null,
  transitionStyle = EOF_DEFAULT_TRANSITION_STYLE,
  colorGrade = EOF_DEFAULT_COLOR_GRADE,
  enhanceStyle = EOF_DEFAULT_ENHANCE_STYLE,
  overlayMoments = EOF_DEFAULT_OVERLAY_MOMENTS,
  videoEffects = EOF_DEFAULT_VIDEO_EFFECTS,
  stickers = EOF_DEFAULT_STICKERS,
  /** 'draft' = plain text only · 'full' = draft + adapt (scheduler) */
  mode = 'draft',
  context = null,
  /** 'standard' | 'production' — Production UI + Script Maker use production (hard gates, no bollox softBest) */
  qualityBar = 'production',
  /**
   * Post a script straight away — skips the AI writer entirely. When set (non-empty),
   * this becomes the job's plain-text draft as-is; the user still runs "Adapt to scenes"
   * next (that step needs AI to break narration into timed scenes), but no script-writing
   * AI call ever happens.
   */
  manualDraft = null,
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
  const templateId = isZapcapCaptionStyle(caption)
    ? normalizeZapcapTemplateId(zapcapTemplateId)
    : ''
  const transition = resolveEofTransitionStyle(transitionStyle)
  const color = resolveEofColorGrade(colorGrade)
  const enhance = resolveEofEnhanceStyle(enhanceStyle)
  const overlay = resolveEofOverlayMoments(overlayMoments)
  const effects = normalizeEofVideoEffects(videoEffects)
  const stickerSel = normalizeEofStickers(stickers)

  let script
  let scriptSource
  let status
  let failureDetail = ''

  const pastedDraft = String(manualDraft || '').trim()
  if (pastedDraft) {
    // User already wrote the script — never call the AI writer for it.
    script = buildEofDraftShell({
      topic: t,
      format,
      plainTextDraft: pastedDraft,
      title: t,
      source: 'manual',
      qualityBar,
    })
    scriptSource = 'manual'
    status = EOF_PRODUCTION_JOB_STATUS.DRAFT
  } else if (mode === 'full') {
    const written = await writeEofProductionScript({ topic: t, format, context, scriptProvider })
    script = written.script
    scriptSource = written.source || 'template'
    status = EOF_PRODUCTION_JOB_STATUS.READY_SCRIPT
    failureDetail = written.failureDetail || ''
    if (written.script?.topic) t = String(written.script.topic).trim() || t
  } else {
    const draft = await writeEofPlainTextDraft({
      topic: t,
      format,
      context,
      scriptProvider,
      qualityBar,
    })
    const resolvedTopic = draft.resolvedTopic || t
    t = resolvedTopic
    script = buildEofDraftShell({
      topic: resolvedTopic,
      format,
      plainTextDraft: draft.plainTextDraft,
      title: draft.title || resolvedTopic,
      source: draft.source,
      judge: draft.judge || null,
      stages: draft.stages || null,
      qualityBar: draft.qualityBar || qualityBar,
    })
    scriptSource = draft.source || 'template'
    status = EOF_PRODUCTION_JOB_STATUS.DRAFT
    failureDetail = draft.failureDetail || ''
  }

  await query(
    `INSERT INTO eof_production_jobs
     (id, topic, title, status, script_json, script_source, music_track_id, music_volume, voice_preset, voice_settings_json, caption_style, zapcap_template_id, transition_style, color_grade, enhance_style, overlay_moments, video_effects_json, stickers_json, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
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
      templateId || null,
      transition,
      color,
      enhance,
      overlay,
      JSON.stringify(effects),
      JSON.stringify(stickerSel),
      createdBy || null,
    ],
  )

  const created = await getEofProductionJob(id)
  return failureDetail ? { ...created, scriptFailureDetail: failureDetail } : created
}

/**
 * Regenerate plain-text draft only (keeps job; clears scenes until Adapt).
 */
export async function regenerateEofProductionDraft(
  id,
  { format, context, scriptProvider, directorNote } = {},
) {
  const job = await getEofProductionJob(id)
  if (!job) throw new Error('Production job not found.')
  const fmt = format || job.script?.format || null
  const previousDraft = String(job.script?.plainTextDraft || '').trim()
  const note = String(directorNote || '').trim().slice(0, 1200)
  // Agent chat / directed rewrite: always seed topic (+ title) so Claude isn't writing generic VO.
  const seededContext = [
    String(context || '').trim(),
    job.topic ? `Ordered topic: ${String(job.topic).trim()}` : '',
    job.title && job.title !== job.topic ? `Working title: ${String(job.title).trim()}` : '',
    job.script?.format || fmt ? `Format: ${fmt || job.script?.format}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const draft = await writeEofPlainTextDraft({
    topic: job.topic,
    format: fmt,
    context: seededContext || undefined,
    scriptProvider,
    regenerate: true,
    previousDraft,
    directorNote: note,
    qualityBar: job.script?.qualityBar || 'production',
  })
  const resolvedTopic = draft.resolvedTopic || job.topic
  const script = buildEofDraftShell({
    topic: resolvedTopic,
    format: fmt,
    plainTextDraft: draft.plainTextDraft,
    title: draft.title || resolvedTopic,
    source: draft.source,
    judge: draft.judge || null,
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
    ttsAudioHash: null,
    ttsSynthCount: 0,
  })
  return {
    ...updated,
    deskSources: draft.deskSources || null,
    judge: draft.judge || null,
    autoTuned: draft.autoTuned || null,
    ...(draft.failureDetail ? { scriptFailureDetail: draft.failureDetail } : {}),
  }
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
    ttsAudioHash: null,
    ttsSynthCount: 0,
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
    ttsAudioHash: null,
    ttsSynthCount: 0,
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
  const musicTrim = normalizeEofMusicTrim({
    musicStartSec:
      patch.musicStartSec !== undefined ? patch.musicStartSec : job.musicStartSec,
    musicEndSec: patch.musicEndSec !== undefined ? patch.musicEndSec : job.musicEndSec,
  })
  const musicStartSec = musicTrim.startSec
  const musicEndSec = musicTrim.endSec
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
  const ttsAudioHash = patch.ttsAudioHash !== undefined ? patch.ttsAudioHash : job.ttsAudioHash
  const ttsSynthCount =
    patch.ttsSynthCount !== undefined
      ? Math.max(0, Number(patch.ttsSynthCount) || 0)
      : job.ttsSynthCount
  const youtubeProjectId =
    patch.youtubeProjectId !== undefined ? patch.youtubeProjectId : job.youtubeProjectId
  const captionStyle =
    patch.captionStyle !== undefined
      ? resolveEofCaptionStyle(patch.captionStyle)
      : resolveEofCaptionStyle(job.captionStyle)
  const captionEngine =
    patch.captionEngine !== undefined ? patch.captionEngine : job.captionEngine
  let zapcapTemplateId =
    patch.zapcapTemplateId !== undefined ? patch.zapcapTemplateId : job.zapcapTemplateId
  if (patch.zapcapTemplateId !== undefined || patch.captionStyle !== undefined) {
    zapcapTemplateId = isZapcapCaptionStyle(captionStyle)
      ? normalizeZapcapTemplateId(zapcapTemplateId)
      : ''
  }
  const transitionStyle =
    patch.transitionStyle !== undefined
      ? resolveEofTransitionStyle(patch.transitionStyle)
      : resolveEofTransitionStyle(job.transitionStyle)
  const colorGrade =
    patch.colorGrade !== undefined
      ? resolveEofColorGrade(patch.colorGrade)
      : resolveEofColorGrade(job.colorGrade)
  const enhanceStyle =
    patch.enhanceStyle !== undefined
      ? resolveEofEnhanceStyle(patch.enhanceStyle)
      : resolveEofEnhanceStyle(job.enhanceStyle)
  const overlayMoments =
    patch.overlayMoments !== undefined
      ? resolveEofOverlayMoments(patch.overlayMoments)
      : resolveEofOverlayMoments(job.overlayMoments)
  const videoEffects = normalizeEofVideoEffects(
    patch.videoEffects !== undefined ? patch.videoEffects : job.videoEffects,
  )
  const stickers = normalizeEofStickers(
    patch.stickers !== undefined ? patch.stickers : job.stickers,
  )
  const captionLayout = normalizeEofCaptionLayout(
    patch.captionLayout !== undefined ? patch.captionLayout : job.captionLayout,
    captionStyle,
  )
  const qualityGate =
    patch.qualityGate !== undefined ? patch.qualityGate : job.qualityGate
  const qualityGateHistory =
    patch.qualityGateHistory !== undefined
      ? patch.qualityGateHistory
      : job.qualityGateHistory
  const videoFootageMode =
    (patch.videoFootageMode !== undefined ? patch.videoFootageMode : job.videoFootageMode) === 'auto'
      ? 'auto'
      : 'off'

  await query(
    `UPDATE eof_production_jobs
     SET topic = $2,
         title = $3,
         status = $4,
         script_json = $5,
         script_source = $6,
         music_track_id = $7,
         music_volume = $8,
         music_start_sec = $9,
         music_end_sec = $10,
         voice_preset = $11,
         voice_settings_json = $12,
         error_message = $13,
         mixed_audio_path = $14,
         narration_manifest_json = $15,
         render_output_path = $16,
         voice_regeneration_count = $17,
         voice_narration_hash = $18,
         tts_audio_hash = $19,
         tts_synth_count = $20,
         youtube_project_id = $21,
         caption_style = $22,
         caption_engine = $23,
         zapcap_template_id = $24,
         transition_style = $25,
         color_grade = $26,
         enhance_style = $27,
         caption_layout_json = $28,
         overlay_moments = $29,
         video_effects_json = $30,
         stickers_json = $31,
         quality_gate_json = $32,
         quality_gate_history_json = $33,
        video_footage_mode = $34,
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
     musicStartSec,
     musicEndSec,
     voicePreset,
     voiceSettings ? JSON.stringify(voiceSettings) : null,
     errorMessage,
     mixedAudioPath,
     narrationManifest ? JSON.stringify(narrationManifest) : null,
     renderOutputPath,
     voiceRegenerationCount,
     voiceNarrationHash,
     ttsAudioHash,
     ttsSynthCount,
     youtubeProjectId,
     captionStyle,
     captionEngine || null,
     zapcapTemplateId || null,
     transitionStyle,
     colorGrade,
     enhanceStyle,
     JSON.stringify(captionLayout),
     overlayMoments,
     JSON.stringify(videoEffects),
     JSON.stringify(stickers),
     qualityGate ? JSON.stringify(qualityGate) : null,
     Array.isArray(qualityGateHistory) && qualityGateHistory.length
       ? JSON.stringify(qualityGateHistory)
       : null,
     videoFootageMode,
    ],
  )

  return getEofProductionJob(id)
}

/**
 * @param {string} id
 * @param {string} message
 * @param {{ onlyWhenRendering?: boolean }} [opts] onlyWhenRendering — skip when the job
 *   already left rendering_*, so a stale poll cannot overwrite a Short that just finished.
 */
export async function markEofProductionJobFailed(id, message, opts = {}) {
  const errorMessage = String(message || 'Failed').slice(0, 500)
  if (opts.onlyWhenRendering) {
    await ensureEofProductionSchema()
    const res = await query(
      `UPDATE eof_production_jobs
       SET status = $2, error_message = $3, render_progress_json = NULL, updated_at = ${nowSql()}
       WHERE id = $1 AND status IN ($4, $5)`,
      [
        id,
        EOF_PRODUCTION_JOB_STATUS.FAILED,
        errorMessage,
        EOF_PRODUCTION_JOB_STATUS.RENDERING,
        EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
      ],
    )
    if (!res.rowCount) {
      console.info(`[eof-production] skipped stale fail for job=${id} — it already left rendering`)
      return getEofProductionJob(id)
    }
    return getEofProductionJob(id)
  }
  await updateEofProductionRenderProgress(id, null)
  return updateEofProductionJob(id, {
    status: EOF_PRODUCTION_JOB_STATUS.FAILED,
    errorMessage,
  })
}

/**
 * Hobby max age for a stuck rendering_* job before poll auto-fails it.
 * Kept aggressive so silent Hobby isolate deaths unstick the UI quickly.
 */
export const EOF_STALE_RENDER_SEC = Number(process.env.EOF_STALE_RENDER_SEC) || 280
/**
 * Hobby/slim: no progress DB write for this long → treat isolate as dead.
 */
export const EOF_STALE_PROGRESS_SEC = Number(process.env.EOF_STALE_PROGRESS_SEC) || 90
/**
 * Pro absolute age ceiling — match Vercel Pro maxDuration (300s).
 * Do NOT raise this forever: if encodes miss 300s that is a pipeline budget bug
 * (see Pro reliable encode), not a reason to leave "Building…" zombies past isolate death.
 * Heartbeats protect under this ceiling so age 281 + live HB is NOT stale.
 */
export const EOF_STALE_PRO_MAX_AGE_SEC = Number(process.env.EOF_STALE_PRO_MAX_AGE_SEC) || 300
/**
 * Pro quiet window: no progress/heartbeat for this long → isolate likely dead.
 * Wide enough that a slow ffmpeg/Serp beat does not false-fail; tight enough to
 * unstick after a silent kill well under maxDuration.
 */
export const EOF_STALE_PRO_QUIET_SEC = Number(process.env.EOF_STALE_PRO_QUIET_SEC) || 160

/**
 * Resolve stale windows for the active Build mode.
 * Pro: recent heartbeat keeps the job alive until maxAge (~300s); quiet kill only
 * after quiet window without heartbeat. Hobby/slim: tighter age + quiet.
 * When EOF_WORKER_URL is set, use a longer absolute ceiling so Railway encodes
 * are not auto-failed at Vercel's 300s maxDuration.
 * @param {{ slim?: boolean }} [opts]
 */
export function resolveEofStaleWindows(opts = {}) {
  const slim = opts.slim === true
  if (slim) {
    const maxAgeSec = Math.max(60, EOF_STALE_RENDER_SEC)
    const maxQuietSec = Math.max(30, EOF_STALE_PROGRESS_SEC)
    return {
      maxAgeSec,
      maxQuietSec,
      slim: true,
      allowQuietKill: true,
    }
  }
  const workerConfigured = Boolean(
    String(process.env.EOF_WORKER_URL || '').trim() &&
      String(process.env.EOF_WORKER_SECRET || '').trim(),
  )
  const workerMaxAge = Number(process.env.EOF_STALE_WORKER_MAX_AGE_SEC) || 900
  const workerQuiet = Number(process.env.EOF_STALE_WORKER_QUIET_SEC) || 240
  const maxAgeSec = workerConfigured
    ? Math.max(EOF_STALE_PRO_MAX_AGE_SEC, workerMaxAge)
    : Math.max(EOF_STALE_RENDER_SEC, EOF_STALE_PRO_MAX_AGE_SEC)
  const maxQuietSec = workerConfigured
    ? Math.max(EOF_STALE_PRO_QUIET_SEC, workerQuiet)
    : Math.max(60, EOF_STALE_PRO_QUIET_SEC)
  return {
    maxAgeSec,
    maxQuietSec,
    slim: false,
    worker: workerConfigured,
    // Quiet kill after quiet window — live heartbeats never age-die before maxAge.
    allowQuietKill: true,
  }
}

/**
 * Pure helper — decide whether a rendering job should be force-failed.
 * @param {{ status?: string, updatedAt?: string|null, renderProgress?: { startedAt?: string|null }|null }} job
 * @param {{ now?: number, maxAgeSec?: number, maxQuietSec?: number, allowQuietKill?: boolean, slim?: boolean }} [opts]
 */
export function isEofRenderStale(job, opts = {}) {
  const status = String(job?.status || '')
  if (status !== EOF_PRODUCTION_JOB_STATUS.RENDERING && status !== EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO) {
    return false
  }
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const slim = opts.slim === true
  const defaults = resolveEofStaleWindows({ slim })
  const maxAgeSec = Math.max(60, Number(opts.maxAgeSec) || defaults.maxAgeSec)
  const maxQuietSec = Math.max(30, Number(opts.maxQuietSec) || defaults.maxQuietSec)
  // Explicit false wins; otherwise use window default (Pro + Hobby both quiet-kill now).
  const allowQuietKill =
    opts.allowQuietKill === true ||
    (opts.allowQuietKill !== false && defaults.allowQuietKill === true)

  const startedRaw = job?.renderProgress?.startedAt || job?.updatedAt
  const startedMs = startedRaw ? Date.parse(String(startedRaw)) : NaN
  const updatedMs = job?.updatedAt ? Date.parse(String(job.updatedAt)) : NaN
  const ageSec = Number.isFinite(startedMs) ? (now - startedMs) / 1000 : Infinity
  const quietSec = Number.isFinite(updatedMs) ? (now - updatedMs) / 1000 : ageSec

  // Absolute ceiling (Hobby ~280s, Pro ~300s = maxDuration) — age 281 + live HB is NOT dead.
  if (ageSec >= maxAgeSec) return true
  // Recent progress / heartbeat → still running under maxDuration.
  if (quietSec < maxQuietSec) return false
  if (!allowQuietKill) return false
  return true
}

/**
 * Auto-fail jobs stuck in rendering / rendering_video (Vercel waitUntil killed mid-build).
 * Called from Production GET poll so the UI unblocks without a manual cancel.
 * @param {{ maxAgeSec?: number, maxQuietSec?: number, allowQuietKill?: boolean, slim?: boolean }} [opts]
 * @returns {Promise<string[]>} failed job ids
 */
export async function failStaleEofProductionRenders(opts = {}) {
  const jobs = await listEofProductionJobs(80)
  const failed = []
  const now = Date.now()
  const slim =
    opts.slim != null ? opts.slim === true : await isEofSlimBuildEnabled().catch(() => false)
  const windows = resolveEofStaleWindows({ slim })
  const staleOpts = {
    now,
    maxAgeSec: opts.maxAgeSec != null ? opts.maxAgeSec : windows.maxAgeSec,
    maxQuietSec: opts.maxQuietSec != null ? opts.maxQuietSec : windows.maxQuietSec,
    allowQuietKill: opts.allowQuietKill != null ? opts.allowQuietKill : windows.allowQuietKill,
    slim,
  }
  for (const job of jobs) {
    if (!isEofRenderStale(job, staleOpts)) continue
    const startedRaw = job?.renderProgress?.startedAt || job?.updatedAt
    const ageSec = startedRaw
      ? Math.round((now - Date.parse(String(startedRaw))) / 1000)
      : staleOpts.maxAgeSec
    const quietHint =
      staleOpts.allowQuietKill !== false
        ? ` quiet>${staleOpts.maxQuietSec}s or`
        : ''
    const message = slim
      ? `Render stuck / timed out after ${ageSec}s (serverless isolate stopped mid-build). ` +
        `Cancel if stuck, then Rebuild once. Build mode is Hobby (slim) — or set EOF_FORCE_SLIM=1 on the server.`
      : `Render stuck / timed out after ${ageSec}s (serverless isolate stopped mid-build). ` +
        `Cancel if stuck, then Rebuild once. Build mode is Pro — poll fails only after${quietHint} ~${staleOpts.maxAgeSec}s absolute; do not Rebuild while a live encode is still running.`
    console.warn(
      `[eof-production] auto-fail stale render job=${job.id} age=${ageSec}s slim=${slim} maxAge=${staleOpts.maxAgeSec}s quiet=${staleOpts.maxQuietSec}s`,
    )
    const after = await markEofProductionJobFailed(job.id, message, { onlyWhenRendering: true })
    if (after?.status !== EOF_PRODUCTION_JOB_STATUS.FAILED) continue
    failed.push(job.id)
  }
  return failed
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
