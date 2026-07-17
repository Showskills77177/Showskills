import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_HOBBY_AUTO_PUBLISH_UTC,
  EOF_HOBBY_SCRIPT_MAKER_UTC,
  eofOvernightPipelineNote,
  estimatePublishAtIso,
  formatPublishAtLabels,
  formatUtcClock,
  isAutoPublishAlignedWithHobbyCron,
  isEofSchedulerHourMatch,
  utcClockToLondonLabel,
} from './eofSchedulerTime.mjs'
import { isLondonLocalMidnightHour } from './eofScriptMakerSchedule.mjs'

describe('eof scheduler hour gate', () => {
  it('matches configured UTC hour so 23:00 Script Maker fire skips auto-publish at 09:00 setting', () => {
    const morning = new Date('2026-07-17T09:00:00.000Z')
    const midnightSlot = new Date('2026-07-17T23:00:00.000Z')
    assert.equal(isEofSchedulerHourMatch(morning, 9, 0), true)
    assert.equal(isEofSchedulerHourMatch(midnightSlot, 9, 0), false)
    assert.equal(isEofSchedulerHourMatch(midnightSlot, 23, 0), true)
  })

  it('respects minuteUtc floor within the hour', () => {
    assert.equal(isEofSchedulerHourMatch(new Date('2026-07-17T09:00:00.000Z'), 9, 15), false)
    assert.equal(isEofSchedulerHourMatch(new Date('2026-07-17T09:15:00.000Z'), 9, 15), true)
    assert.equal(isEofSchedulerHourMatch(new Date('2026-07-17T09:40:00.000Z'), 9, 15), true)
  })
})

describe('eof auto-publish / Script Maker alignment', () => {
  it('Hobby defaults: 09:00 UTC publish + 23:00 UTC Script Maker slot', () => {
    assert.deepEqual(EOF_HOBBY_AUTO_PUBLISH_UTC, { hour: 9, minute: 0 })
    assert.deepEqual(EOF_HOBBY_SCRIPT_MAKER_UTC, { hour: 23, minute: 0 })
    assert.equal(isAutoPublishAlignedWithHobbyCron(9, 0), true)
    assert.equal(isAutoPublishAlignedWithHobbyCron(10, 0), false)
  })

  it('UK midnight gate stays on Europe/London (BST summer)', () => {
    assert.equal(isLondonLocalMidnightHour(new Date('2026-07-15T23:00:00.000Z')), true)
    assert.equal(isLondonLocalMidnightHour(new Date('2026-07-16T09:00:00.000Z')), false)
  })

  it('pipeline note flags misaligned hours', () => {
    const ok = eofOvernightPipelineNote({ hourUtc: 9, minuteUtc: 0, autoPublishEnabled: true })
    assert.equal(ok.alignedWithHobbyCron, true)
    assert.equal(ok.autoPublishEnabled, true)
    const bad = eofOvernightPipelineNote({ hourUtc: 14, minuteUtc: 0, autoPublishEnabled: false })
    assert.equal(bad.alignedWithHobbyCron, false)
    assert.match(bad.autoPublish, /set Hour to 9/i)
  })

  it('formats UTC and London clocks for the schedule UI', () => {
    assert.equal(formatUtcClock(9, 0), '09:00 UTC')
    // 09:00 UTC in mid-July = 10:00 BST
    assert.match(utcClockToLondonLabel(9, 0, new Date('2026-07-17T12:00:00.000Z')), /10:00 UK/)
  })

  it('publish-at preview advances by delay minutes', () => {
    const from = new Date('2026-07-17T09:00:00.000Z')
    const iso = estimatePublishAtIso(30, from)
    assert.equal(iso, '2026-07-17T09:30:00.000Z')
    const labels = formatPublishAtLabels(iso)
    assert.match(labels.utc, /09:30/)
    assert.ok(labels.london.includes('UK'))
  })
})
