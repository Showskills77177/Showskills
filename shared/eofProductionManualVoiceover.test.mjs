import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

/** Generates a short silent WAV via the project's own ffmpeg-static — stands in for a user-uploaded voiceover file. */
async function makeSilentWav(path, seconds) {
  const { runFfmpeg } = await import('../backend/api/lib/eofFfmpeg.mjs')
  await runFfmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', `anullsrc=r=44100:cl=mono`,
    '-t', String(seconds),
    path,
  ])
}


describe('post-your-own-voiceover (skip TTS) — renderEofProductionAudio', () => {
  let tmpDir
  let uploadPath
  const prevSqlite = process.env.SQLITE_PATH
  const prevDatabaseUrl = process.env.DATABASE_URL
  const prevPostgresUrl = process.env.POSTGRES_URL

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'eof-manual-vo-'))
    process.env.SQLITE_PATH = join(tmpDir, 'test.sqlite')
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
    uploadPath = join(tmpDir, 'uploaded.wav')
    await makeSilentWav(uploadPath, 6)
  })

  after(() => {
    if (prevSqlite === undefined) delete process.env.SQLITE_PATH
    else process.env.SQLITE_PATH = prevSqlite
    if (prevDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prevDatabaseUrl
    if (prevPostgresUrl === undefined) delete process.env.POSTGRES_URL
    else process.env.POSTGRES_URL = prevPostgresUrl
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('mixes the uploaded voiceover as-is, splits scene durations by narration length, and never calls TTS', async () => {
    const { createEofProductionJob, updateEofProductionJob, getEofProductionJob } = await import(
      '../backend/api/lib/eofProductionJobs.mjs'
    )
    const { saveEofManualVoiceoverArtifact } = await import(
      '../backend/api/lib/eofProductionArtifacts.mjs'
    )
    const { renderEofProductionAudio } = await import('../backend/api/lib/eofProductionRender.mjs')

    const created = await createEofProductionJob({
      topic: 'Marc Cucurella',
      createdBy: 'tester',
      manualDraft: 'Cucurella joined Chelsea from Brighton in a big-money move.',
    })

    const scenes = [
      { id: 's1', narration: 'Short line.', caption: 'Short line.', imageQuery: 'cucurella' },
      {
        id: 's2',
        narration: 'A much longer narration line that should take proportionally more time.',
        caption: 'Longer line.',
        imageQuery: 'cucurella chelsea',
      },
    ]
    await updateEofProductionJob(created.id, {
      voicePreset: 'manual',
      script: { ...created.script, scenes },
    })

    const saved = await saveEofManualVoiceoverArtifact(created.id, uploadPath, 'audio/wav')
    assert.ok(saved, 'expected the uploaded voiceover to be saved as a durable artifact')

    const result = await renderEofProductionAudio(created.id, { allowNoMusic: true })

    assert.equal(result.status, 'rendered')
    assert.ok(result.mixedAudioPath, 'expected a mixed audio path to be set')
    assert.ok(existsSync(join(tmpDir, '..')), 'sanity: tmp dir usable')

    // Scene 2's narration is much longer than scene 1's — its allotted duration must be larger.
    assert.ok(
      result.script.scenes[1].durationSec > result.script.scenes[0].durationSec,
      `expected scene 2 duration (${result.script.scenes[1].durationSec}) > scene 1 (${result.script.scenes[0].durationSec})`,
    )
    // Total allotted duration should roughly match the uploaded file's ~6s length.
    const total = result.script.scenes[0].durationSec + result.script.scenes[1].durationSec
    assert.ok(total > 4 && total < 8, `expected total scene duration near 6s, got ${total}`)

    assert.equal(result.narrationManifest.length, 2)
    assert.ok(result.narrationManifest.every((m) => m.manualVoiceover === true))

    const reloaded = await getEofProductionJob(created.id)
    assert.equal(reloaded.status, 'rendered')
  })

  it('throws a clear error when no voiceover has been uploaded yet', async () => {
    const { createEofProductionJob, updateEofProductionJob } = await import(
      '../backend/api/lib/eofProductionJobs.mjs'
    )
    const { renderEofProductionAudio } = await import('../backend/api/lib/eofProductionRender.mjs')

    const created = await createEofProductionJob({
      topic: 'Klopp',
      createdBy: 'tester',
      manualDraft: 'Jurgen Klopp managed Liverpool for almost a decade.',
    })
    await updateEofProductionJob(created.id, {
      voicePreset: 'manual',
      script: {
        ...created.script,
        scenes: [{ id: 's1', narration: 'Klopp line.', caption: 'Klopp line.', imageQuery: 'klopp' }],
      },
    })

    await assert.rejects(
      renderEofProductionAudio(created.id, { allowNoMusic: true }),
      /No voiceover uploaded yet/,
    )
  })
})
