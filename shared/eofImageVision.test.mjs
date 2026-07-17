import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MIN_EOF_VISION_SCORE,
  clampEofVisionRow,
  applyVisionScoresToHits,
} from '../backend/api/lib/eofImageVision.mjs'
import {
  hitMentionsSubject,
  isNamedFootballSubject,
  filterHitsRequiringSubjectNameCue,
  looksLikeGroupPhotoCue,
} from './eofSceneImageQueries.mjs'
import { claimOxylabsPoolHit, scoreOxylabsHitForScene } from '../backend/api/lib/eofOxylabsImages.mjs'

describe('eof subject name cues', () => {
  it('detects Rooney in title/URL and rejects unrelated stills', () => {
    assert.equal(isNamedFootballSubject('Wayne Rooney'), true)
    assert.equal(hitMentionsSubject('Wayne Rooney', 'Wayne Rooney Sky Sports studio', ''), true)
    assert.equal(hitMentionsSubject('Wayne Rooney', 'Two guys posing at a party', ''), false)
    assert.equal(
      hitMentionsSubject('Wayne Rooney', '', 'https://cdn.example.com/wayne-rooney-portrait.jpg'),
      true,
    )
    assert.equal(looksLikeGroupPhotoCue('Two guys posing football'), true)
  })

  it('filterHitsRequiringSubjectNameCue drops wrong-person + group titles', () => {
    const hits = [
      { url: 'https://a.test/1.jpg', title: 'Two guys posing football friends' },
      { url: 'https://a.test/2.jpg', title: 'Random Premier League stock' },
      { url: 'https://a.test/3.jpg', title: 'Wayne Rooney portrait press photo' },
      {
        url: 'file:///tmp/gen.jpg',
        localPath: '/tmp/gen.jpg',
        source: 'free-gen',
        title: 'Wayne Rooney — free AI still (pundit)',
      },
    ]
    const kept = filterHitsRequiringSubjectNameCue(hits, 'Wayne Rooney', { log: false })
    assert.equal(kept.length, 2)
    assert.equal(kept[0].url, 'https://a.test/3.jpg')
    assert.equal(kept[1].source, 'free-gen')
  })
})

describe('eofImageVision clamp + apply', () => {
  it(`exports MIN_EOF_VISION_SCORE=${6}`, () => {
    assert.equal(MIN_EOF_VISION_SCORE, 6)
  })

  it('hard-fails subject_visible=false and wrong person labels', () => {
    const missing = clampEofVisionRow(
      { score: 9, subject_visible: false, person: 'Unknown guys' },
      'Wayne Rooney',
    )
    assert.ok(missing.score <= 1)
    assert.equal(missing.rejected, true)
    assert.match(missing.reason, /subject_not_visible/)

    const wrong = clampEofVisionRow(
      { score: 8, subject_visible: true, person: 'Harry Kane' },
      'Wayne Rooney',
    )
    assert.ok(wrong.score <= 1)
    assert.equal(wrong.rejected, true)
    assert.match(wrong.reason, /wrong_person/)

    const ok = clampEofVisionRow(
      { score: 8, subject_visible: true, person: 'Wayne Rooney' },
      'Wayne Rooney',
    )
    assert.equal(ok.score, 8)
    assert.equal(ok.rejected, false)
  })

  it('applyVisionScoresToHits drops scores below 6 and unscored URLs', () => {
    const scores = new Map([
      ['https://ok.test/rooney.jpg', 7],
      ['https://low.test/group.jpg', 4],
      ['https://wrong.test/duo.jpg', 1],
    ])
    const ranked = applyVisionScoresToHits(
      [
        { url: 'https://unscored.test/x.jpg', title: 'Wayne Rooney maybe' },
        { url: 'https://low.test/group.jpg', title: 'Group' },
        { url: 'https://wrong.test/duo.jpg', title: 'Two guys' },
        { url: 'https://ok.test/rooney.jpg', title: 'Wayne Rooney', source: 'serpapi' },
      ],
      scores,
    )
    assert.equal(ranked.length, 1)
    assert.equal(ranked[0].url, 'https://ok.test/rooney.jpg')
    assert.equal(ranked[0].visionScore, 7)
  })

  it('applyVisionScoresToHits prefers scrape on equal scores', () => {
    const scores = new Map([
      ['https://scrape.test/a.jpg', 7],
      ['https://gen.test/b.jpg', 7],
    ])
    const ranked = applyVisionScoresToHits(
      [
        { url: 'https://gen.test/b.jpg', source: 'grok-imagine', title: 'AI' },
        { url: 'https://scrape.test/a.jpg', source: 'serpapi', title: 'Real' },
      ],
      scores,
    )
    assert.equal(ranked[0].source, 'serpapi')
    assert.equal(ranked[1].source, 'grok-imagine')
  })
})

describe('claimOxylabsPoolHit subject gate', () => {
  it('never claims a still that does not name Rooney', () => {
    const hits = [
      {
        url: 'https://cdn.example.com/two-guys.jpg',
        title: 'Two guys posing football lifestyle',
        width: 900,
        height: 1200,
      },
      {
        url: 'https://cdn.example.com/crowd.jpg',
        title: 'Premier League fans night',
        width: 900,
        height: 1200,
      },
      {
        url: 'https://cdn.example.com/rooney.jpg',
        title: 'Wayne Rooney Sky Sports pundit studio',
        width: 900,
        height: 1200,
      },
    ]
    const claimed = new Set()
    const pick = claimOxylabsPoolHit({
      hits,
      claimed,
      topic: 'Wayne Rooney on Ronaldo',
      subject: 'Wayne Rooney',
      imageQuery: 'Wayne Rooney pundit',
      caption: 'Rooney slammed him from the desk',
      index: 0,
    })
    assert.equal(pick.imgUrl, 'https://cdn.example.com/rooney.jpg')
    assert.ok(
      scoreOxylabsHitForScene(hits[0], {
        topic: 'Wayne Rooney',
        subject: 'Wayne Rooney',
      }) <= -100,
    )
  })

  it('returns null when every candidate lacks the subject cue', () => {
    const hits = [
      {
        url: 'https://cdn.example.com/a.jpg',
        title: 'Two guys posing with nothing to do with football',
        width: 900,
        height: 1200,
      },
      {
        url: 'https://cdn.example.com/b.jpg',
        title: 'Random couple lifestyle shoot',
        width: 900,
        height: 1200,
      },
    ]
    const pick = claimOxylabsPoolHit({
      hits,
      claimed: new Set(),
      topic: 'Wayne Rooney',
      subject: 'Wayne Rooney',
      imageQuery: 'Wayne Rooney',
      index: 0,
    })
    assert.equal(pick, null)
  })

  it('demotes group-photo titles vs solo Rooney portraits', () => {
    const group = scoreOxylabsHitForScene(
      {
        url: 'https://cdn.example.com/group.jpg',
        title: 'Wayne Rooney with two friends posing',
        width: 900,
        height: 1200,
      },
      { topic: 'Wayne Rooney', subject: 'Wayne Rooney', intent: 'pundit' },
    )
    const solo = scoreOxylabsHitForScene(
      {
        url: 'https://cdn.example.com/solo.jpg',
        title: 'Wayne Rooney portrait press photo',
        width: 900,
        height: 1200,
      },
      { topic: 'Wayne Rooney', subject: 'Wayne Rooney', intent: 'pundit' },
    )
    assert.ok(solo > group, `solo (${solo}) should beat group (${group})`)
  })
})
