/**
 * Persist Short quality-gate results on a production job (avoids circular imports).
 */
import { EOF_PRODUCTION_JOB_STATUS } from '../../../shared/eofProduction.mjs'
import { listSecondaryImageSubjects } from '../../../shared/eofSceneImageQueries.mjs'
import {
  getEofProductionJob,
  updateEofProductionJob,
  updateEofProductionRenderProgress,
} from './eofProductionJobs.mjs'
import {
  runEofShortQualityGate,
  runEofShortQualityPreflight,
  runEofShortQualityStillsPreflight,
  formatEofQualityGateBlockMessage,
  isEofShortQualityGateEnabled,
  EofQualityGateBlockedError,
} from './eofShortQualityGate.mjs'

/**
 * Enrich renderMeta with secondary-subject hints from the script when missing.
 * @param {object} job
 * @param {object} [renderMeta]
 */
function withSecondarySubjectMeta(job, renderMeta = {}) {
  const meta = { ...renderMeta }
  if (meta.hasSecondarySubject != null) return meta
  const draft = String(job?.script?.plainTextDraft || '').trim()
  const secondary = listSecondaryImageSubjects(job?.topic, draft)
  meta.hasSecondarySubject = secondary.length > 0
  if (meta.secondarySceneIndex == null && secondary.length) {
    const n = job?.script?.scenes?.length || 0
    meta.secondarySceneIndex = n >= 3 ? Math.min(1, Math.max(0, n - 2)) : null
  }
  return meta
}

/**
 * Persist a blocking gate failure and throw so callers stop expensive work.
 * @param {string} jobId
 * @param {import('./eofShortQualityGate.mjs').EofQualityGateResult} gate
 */
async function persistBlockedGateAndThrow(jobId, gate) {
  await updateEofProductionRenderProgress(jobId, null)
  await updateEofProductionJob(jobId, {
    qualityGate: gate,
    status: EOF_PRODUCTION_JOB_STATUS.FAILED,
    errorMessage: formatEofQualityGateBlockMessage(gate),
  })
  throw new EofQualityGateBlockedError(gate)
}

/**
 * Plan-time preflight — before image fetch / TTS / ffmpeg.
 * On hard fail: persist `qualityGate`, mark job failed, throw.
 * @param {string} jobId
 * @param {{
 *   mode?: 'auto'|'manual',
 *   renderMeta?: object,
 *   blockOnFail?: boolean,
 * }} [opts]
 */
export async function applyEofShortQualityPreflightToJob(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const renderMeta = withSecondarySubjectMeta(job, opts.renderMeta || {})
  const gate = runEofShortQualityPreflight(job, {
    mode: opts.mode === 'auto' ? 'auto' : 'manual',
    renderMeta,
    blockOnFail: opts.blockOnFail !== false,
  })

  if (!gate.pass && gate.blocked) {
    await persistBlockedGateAndThrow(jobId, gate)
  }

  await updateEofProductionJob(jobId, { qualityGate: gate })
  return { job: await getEofProductionJob(jobId), gate }
}

/**
 * Stills-assignment preflight — after images known, before ffmpeg.
 * @param {string} jobId
 * @param {{
 *   mode?: 'auto'|'manual',
 *   renderMeta?: object,
 *   blockOnFail?: boolean,
 *   jobSnapshot?: object,
 * }} [opts]
 */
export async function applyEofShortQualityStillsPreflightToJob(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const snapshot = opts.jobSnapshot ? { ...job, ...opts.jobSnapshot } : job
  const renderMeta = withSecondarySubjectMeta(snapshot, opts.renderMeta || {})
  const gate = runEofShortQualityStillsPreflight(snapshot, {
    mode: opts.mode === 'auto' ? 'auto' : 'manual',
    renderMeta,
    blockOnFail: opts.blockOnFail !== false,
  })

  if (!gate.pass && gate.blocked) {
    await persistBlockedGateAndThrow(jobId, gate)
  }

  await updateEofProductionJob(jobId, { qualityGate: gate })
  return { job: await getEofProductionJob(jobId), gate }
}

/**
 * Run quality gate against the latest job row and persist `qualityGate`.
 * @param {string} jobId
 * @param {{
 *   mode?: 'auto'|'manual',
 *   renderMeta?: object,
 *   blockOnFail?: boolean,
 *   skipVision?: boolean,
 *   setErrorMessageOnFail?: boolean,
 * }} [opts]
 */
export async function applyEofShortQualityGateToJob(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  if (!isEofShortQualityGateEnabled()) {
    const gate = await runEofShortQualityGate(job, { mode: opts.mode || 'manual', skipVision: true })
    await updateEofProductionJob(jobId, { qualityGate: gate })
    return { job: await getEofProductionJob(jobId), gate }
  }

  const gate = await runEofShortQualityGate(job, {
    mode: opts.mode === 'auto' ? 'auto' : 'manual',
    renderMeta: opts.renderMeta || {},
    blockOnFail: opts.blockOnFail,
    skipVision: opts.skipVision,
  })

  const patch = { qualityGate: gate }
  if (opts.setErrorMessageOnFail && gate.blocked) {
    patch.errorMessage = formatEofQualityGateBlockMessage(gate)
  }

  const updated = await updateEofProductionJob(jobId, patch)
  return { job: updated, gate }
}

export {
  formatEofQualityGateBlockMessage,
  isEofShortQualityGateEnabled,
  EofQualityGateBlockedError,
}
