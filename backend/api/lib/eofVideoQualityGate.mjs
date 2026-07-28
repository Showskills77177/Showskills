/**
 * Quality Gate: technical checks + copyright-risk + content-relevance.
 * Pass => continue to processing. Fail on ANY check => abandon this video,
 * caller falls back to images. Never force a bad/risky clip through.
 */
import { statSync } from 'node:fs'
import { runFfprobe } from './eofFfmpeg.mjs'
import {
  assessEofVideoTechnicalGate,
  assessEofVideoCopyrightRisk,
} from '../../../shared/eofVideoFootage.mjs'
import { findBestEofVideoMoment } from './eofVideoFrameMatch.mjs'

/**
 * ffprobe a downloaded file for duration/width/height.
 * @param {string} filePath
 */
export async function probeEofVideoFile(filePath) {
  const { stdout } = await runFfprobe(
    [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json',
      filePath,
    ],
    { timeoutMs: 15_000 },
  )
  const data = JSON.parse(stdout || '{}')
  const stream = data?.streams?.[0] || {}
  return {
    width: Number(stream.width) || 0,
    height: Number(stream.height) || 0,
    durationSec: Number(data?.format?.duration) || 0,
  }
}

/**
 * Run the full Quality Gate on a downloaded candidate: technical, copyright
 * risk, then (if those pass) content relevance via vision frame-matching.
 * @param {{ candidate: object, filePath: string, sceneCaption: string, subject?: string }} input
 * @returns {Promise<{ pass: boolean, reason: string, bestTimestampSec: number|null, durationSec: number }>}
 */
export async function runEofVideoQualityGate({ candidate, filePath, sceneCaption, subject }) {
  const sizeBytes = statSync(filePath).size

  let probe
  try {
    probe = await probeEofVideoFile(filePath)
  } catch (err) {
    return { pass: false, reason: `probe failed: ${err.message}`, bestTimestampSec: null, durationSec: 0 }
  }

  const technical = assessEofVideoTechnicalGate({
    sizeBytes,
    durationSec: probe.durationSec,
    width: probe.width,
    height: probe.height,
  })
  if (!technical.pass) {
    return {
      pass: false,
      reason: `technical: ${technical.reasons.join('; ')}`,
      bestTimestampSec: null,
      durationSec: probe.durationSec,
    }
  }

  const risk = assessEofVideoCopyrightRisk(candidate)
  if (risk.risk === 'high') {
    return {
      pass: false,
      reason: `copyright risk too high: ${risk.reasons.join('; ')}`,
      bestTimestampSec: null,
      durationSec: probe.durationSec,
    }
  }

  const moment = await findBestEofVideoMoment({
    filePath,
    durationSec: probe.durationSec,
    sceneCaption,
    subject,
  })
  if (!moment.matched) {
    return {
      pass: false,
      reason: `no matching moment found (score ${moment.score}): ${moment.reason || 'n/a'}`,
      bestTimestampSec: null,
      durationSec: probe.durationSec,
    }
  }

  return {
    pass: true,
    reason: 'ok',
    bestTimestampSec: moment.bestTimestampSec,
    durationSec: probe.durationSec,
  }
}
