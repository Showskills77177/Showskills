/**
 * Persist Short quality-gate results on a production job (avoids circular imports).
 */
import { getEofProductionJob, updateEofProductionJob } from './eofProductionJobs.mjs'
import {
  runEofShortQualityGate,
  formatEofQualityGateBlockMessage,
  isEofShortQualityGateEnabled,
} from './eofShortQualityGate.mjs'

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

export { formatEofQualityGateBlockMessage, isEofShortQualityGateEnabled }
