import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractTopicImageTokens,
  buildSceneImageSearchQueries,
  scoreImageRelevance,
  defaultSceneImageQuery,
  sanitizeTopicForImageSearch,
  resolveImageSubject,
  anchorSceneImageQuery,
  imageAngleFromCaption,
  detectImageRoleIntent,
  hitMentionsSubject,
  filterHitsRequiringSubjectNameCue,
  primaryImageEntities,
  splitGluedPersonClubEntity,
  entityMentionsInHaystack,
  topicLooksLikeCoach,
  expandPlayerFullName,
} from './eofSceneImageQueries.mjs'
import { normalizeFootballTopicQuery } from './eofFootballTopicNormalize.mjs'

describe('eofSceneImageQueries', () => {
  it('extracts topic tokens from headlines', () => {
    const tokens = extractTopicImageTokens('Cristiano Ronaldo scores for Al Nassr')
    assert.ok(tokens.some((t) => /ronaldo/i.test(t)))
    assert.ok(tokens.some((t) => /nassr/i.test(t)))
  })

  it('puts topic-specific queries before generics', () => {
    const qs = buildSceneImageSearchQueries({
      topic: 'Vinicius Jr Real Madrid',
      imageQuery: 'Vinicius Jr celebrating goal football',
      sceneIndex: 0,
    })
    assert.equal(qs[0], 'Vinicius Jr celebrating goal football')
    assert.ok(qs.some((q) => /Vinicius|Real Madrid/i.test(q) && /\d{4}|latest/i.test(q)))
    assert.ok(!qs[0].includes('stadium crowd'))
  })

  it('scores relevance and penalises NFL', () => {
    assert.ok(scoreImageRelevance('Ronaldo', 'Cristiano Ronaldo celebrating football') > 5)
    assert.ok(scoreImageRelevance('Ronaldo', 'NFL american football draft') < 0)
  })

  it('treats Tuchel as a coach, not a player', () => {
    const qs = buildSceneImageSearchQueries({ topic: 'Thomas Tuchel', sceneIndex: 0 })
    assert.ok(qs.some((q) => /manager|coach/i.test(q)))
    assert.ok(!qs.some((q) => /football player/i.test(q)))
    const angle = defaultSceneImageQuery('Thomas Tuchel', 0)
    assert.match(angle, /manager|coach|sideline|press|training/i)
  })

  it('boosts current-year + name hits for coaches', () => {
    const year = new Date().getFullYear()
    const good = scoreImageRelevance(
      'Thomas Tuchel',
      `Thomas Tuchel England manager press conference ${year}`,
    )
    const old = scoreImageRelevance('Thomas Tuchel', 'Dortmund throwback 2013 archive')
    assert.ok(good > old)
  })

  it('defaultSceneImageQuery stays on-topic', () => {
    const q = defaultSceneImageQuery('Erling Haaland', 0)
    assert.match(q, /Haaland/i)
    assert.match(q, /football|match|celebrating|press|training/i)
  })

  it('follows the caption beat instead of the scene-index round-robin (manual/local-split path)', () => {
    // Regression: local-split (manual script) scenes only ever set imageQuery via
    // defaultSceneImageQuery's angle-rotation-by-scene-index — a "trains every day"
    // caption at scene index 2 got the "celebrating" angle just because that is
    // where the rotation landed, and a goal-celebration caption got "press
    // conference". Both must now follow their own caption's beat.
    const trainingBeat = defaultSceneImageQuery('Marc Cucurella hair', 2, {
      caption: 'Cucurella trains every single day with the same routine.',
    })
    assert.match(trainingBeat, /Cucurella/i)
    assert.match(trainingBeat, /train/i)
    assert.doesNotMatch(trainingBeat, /celebrat/i)

    const goalBeat = defaultSceneImageQuery('Marc Cucurella hair', 3, {
      caption: 'He scored a stunning goal and celebrated wildly in front of the fans.',
    })
    assert.match(goalBeat, /Cucurella/i)
    assert.match(goalBeat, /celebrat/i)

    // A caption with no distinct beat still gets the round-robin angle (unchanged).
    const generic = defaultSceneImageQuery('Erling Haaland', 0, { caption: 'Fans cannot stop talking about it.' })
    assert.match(generic, /Haaland/i)
    assert.match(generic, /football|match|celebrating|press|training/i)
  })

  it('does not glue the year onto the name entity (Tuchel 2026)', () => {
    // Regression: "2026" was glued into the proper-noun run → required entity became
    // "Thomas Tuchel 2026", hard-rejecting real current photos titled "Thomas Tuchel England v Ghana 2026".
    const tokens = extractTopicImageTokens('Thomas Tuchel 2026')
    assert.ok(tokens.includes('Thomas Tuchel'), `expected clean name token, got ${JSON.stringify(tokens)}`)
    assert.ok(!tokens.some((t) => /tuchel\s+2026/i.test(t)), `year must not glue to name: ${JSON.stringify(tokens)}`)
    const current = scoreImageRelevance(
      'Thomas Tuchel 2026',
      'Thomas Tuchel England v Ghana 23 June 2026',
      'Thomas Tuchel 2026',
    )
    assert.ok(current > 5, `current on-topic photo must be accepted, got ${current}`)
  })

  it('prefers a current-year photo over an old one (rejects stale)', () => {
    const current = scoreImageRelevance('Thomas Tuchel', 'Thomas Tuchel England v Ghana 23 June 2026')
    const old = scoreImageRelevance('Thomas Tuchel', 'Thomas Tuchel coach Mainz05 at away match in Leverkusen 2014')
    assert.ok(current > old, `current (${current}) should beat old (${old})`)
    assert.ok(old < 6, `old 2014 photo should fall below the accept threshold, got ${old}`)
  })

  it('does not reject photos when topic and imageQuery repeat the same name', () => {
    // Regression: "Thomas Tuchel" + "Thomas Tuchel" glued into required entity
    // "Thomas Tuchel Thomas Tuchel" → hard-rejected every real Commons file.
    const score = scoreImageRelevance(
      'Thomas Tuchel',
      'Thomas Tuchel England v Ghana 23 June 2026-081.jpg',
      'Thomas Tuchel',
    )
    assert.ok(score >= 6, `repeated name must still accept current photo, got ${score}`)
  })

  it('strips quote soundbites so Tuchel headlines still resolve to Thomas Tuchel', () => {
    const topic = 'Thomas Tuchel: "We were sloppy, we were not fast enough"'
    assert.equal(sanitizeTopicForImageSearch(topic), 'Thomas Tuchel')
    assert.equal(resolveImageSubject(topic), 'Thomas Tuchel')
    const tokens = extractTopicImageTokens(topic)
    assert.ok(tokens.includes('Thomas Tuchel'), `tokens=${JSON.stringify(tokens)}`)
    assert.ok(!tokens.some((t) => /\bWe\b/.test(t)), `must not glue We onto name: ${JSON.stringify(tokens)}`)
    const score = scoreImageRelevance(topic, 'Thomas Tuchel England v Ghana 23 June 2026-081.jpg')
    assert.ok(score >= 6, `quoted headline must accept current photo, got ${score}`)
  })

  it('Messi World Cup topics search Messi first, not generic World Cup stock', () => {
    const topic = 'Messi shines at World Cup 2026'
    const tokens = extractTopicImageTokens(topic)
    assert.ok(tokens[0] && /messi/i.test(tokens[0]), `expected Messi-first tokens, got ${tokens}`)
    const qs = buildSceneImageSearchQueries({ topic, sceneIndex: 0 })
    assert.ok(qs[0] && /messi/i.test(qs[0]), `first query should include Messi: ${qs[0]}`)
    assert.ok(!/^world cup/i.test(qs[0]))
    const good = scoreImageRelevance(topic, 'Lionel Messi Argentina World Cup celebration')
    const bad = scoreImageRelevance(topic, 'World Cup stadium crowd Mexico 2026')
    assert.ok(good > 5)
    assert.ok(bad < 0, `generic World Cup stock must be rejected, got ${bad}`)
  })

  it('anchors tactics/England caption beats to the lead coach', () => {
    const q = anchorSceneImageQuery({
      topic: 'Did Tuchel tactics cost England?',
      imageQuery: 'stadium crowd night lights',
      caption: 'Did his tactics cost England again?',
      sceneIndex: 1,
    })
    assert.match(q, /Tuchel/i)
    assert.match(q, /tactic|England/i)
    assert.equal(
      imageAngleFromCaption('Did his tactics cost England again?', 'Thomas Tuchel', true),
      'Thomas Tuchel tactics board',
    )
  })

  it('resolves Rooney topics to Wayne Rooney and keeps career match photos', () => {
    assert.equal(resolveImageSubject('Rooney returns to Old Trafford'), 'Wayne Rooney')
    assert.equal(resolveImageSubject('Wayne Rooney Everton legend'), 'Wayne Rooney')
    // Lead speaker wins over a secondary star named later in the headline.
    assert.equal(resolveImageSubject('Rooney on Ronaldo service'), 'Wayne Rooney')
    assert.equal(resolveImageSubject('Wayne Rooney says Ronaldo is the problem'), 'Wayne Rooney')
    const career = scoreImageRelevance(
      'Wayne Rooney',
      'Wayne Rooney Manchester United Champions League final 2008',
      '',
      { intent: 'playing' },
    )
    assert.ok(career >= 6, `career Rooney photo must stay usable, got ${career}`)
  })

  it('detects pundit vs playing role intent from topic + draft', () => {
    assert.equal(
      detectImageRoleIntent({
        topic: 'Wayne Rooney on Ronaldo',
        plainTextDraft:
          'Wayne Rooney slammed Cristiano Ronaldo on Sky Sports. The pundit said United need better service.',
        captions: ['Rooney on the studio desk', 'His TNT take went viral'],
      }),
      'pundit',
    )
    assert.equal(
      detectImageRoleIntent({
        topic: 'Wayne Rooney Champions League final',
        plainTextDraft:
          'Wayne Rooney scored that Champions League final goal in 2008. The celebration still lives on.',
      }),
      'playing',
    )
    assert.equal(
      detectImageRoleIntent({
        topic: 'Did Tuchel tactics cost England?',
        plainTextDraft: 'Thomas Tuchel’s tactics left England exposed again.',
      }),
      'coach',
    )
    // Lead name still wins when a secondary star appears later.
    assert.equal(resolveImageSubject('Rooney on Ronaldo service'), 'Wayne Rooney')
  })

  it('ranks studio pundit stills above playing-career kit photos for pundit scripts', () => {
    const year = new Date().getFullYear()
    const opts = {
      intent: 'pundit',
      plainTextDraft: 'Wayne Rooney slammed Ronaldo as a Sky Sports pundit on the studio desk.',
    }
    const studio = scoreImageRelevance(
      'Wayne Rooney on Ronaldo',
      `Wayne Rooney Sky Sports pundit studio ${year}`,
      'Wayne Rooney pundit',
      opts,
    )
    const playing = scoreImageRelevance(
      'Wayne Rooney on Ronaldo',
      'Wayne Rooney Manchester United kit celebration goal 2008',
      'Wayne Rooney pundit',
      opts,
    )
    assert.ok(studio > playing, `studio (${studio}) should beat playing (${playing})`)
    assert.ok(studio >= 6, `studio still must be usable, got ${studio}`)
  })

  it('builds pundit-biased scene queries for Rooney TV takes', () => {
    const qs = buildSceneImageSearchQueries({
      topic: 'Wayne Rooney slammed Ronaldo',
      plainTextDraft: 'Rooney the pundit tore into Ronaldo on Sky Sports studio analysis.',
      sceneIndex: 0,
    })
    assert.ok(qs.some((q) => /pundit|studio|Sky Sports/i.test(q)), `expected pundit queries, got ${qs}`)
    assert.ok(!qs.some((q) => /celebrating football/i.test(q)))
  })

  it('never credits Antonio Conte photos to Michail Antonio (shared "Antonio" token)', () => {
    // Regression: Michail Antonio's surname "Antonio" is also Antonio Conte's
    // first name — the surname-alone fallback in hitMentionsSubject/
    // entityMentionsInHaystack was accepting any "Antonio Conte" press-conference
    // photo as a Michail Antonio still just because it contained the word "Antonio".
    const subject = 'Michail Antonio'
    assert.equal(
      hitMentionsSubject(subject, 'Antonio Conte press conference Napoli', ''),
      false,
      'must not credit a different Antonio to Michail Antonio',
    )
    assert.equal(
      hitMentionsSubject(subject, 'Michail Antonio celebrates for West Ham', ''),
      true,
      'the real Michail Antonio photo must still pass',
    )
    const kept = filterHitsRequiringSubjectNameCue(
      [
        { url: 'https://cdn.example.com/1.jpg', title: 'Antonio Conte speaks to reporters', source: 'serpapi' },
        { url: 'https://cdn.example.com/2.jpg', title: 'Michail Antonio celebrates for West Ham', source: 'serpapi' },
      ],
      subject,
      { log: false },
    )
    assert.deepEqual(kept.map((k) => k.title), ['Michail Antonio celebrates for West Ham'])
  })

  it('resolves Ferguson to Sir Alex Ferguson instead of losing to a named club', () => {
    // Regression: "ferguson" was not a recognized coach, so resolveImageSubject's
    // named-entity ranking skipped him entirely and picked the multi-word club
    // "Man United" as the primary subject instead — Ferguson never got his own
    // images sourced because the image search targeted the club, not him.
    assert.equal(resolveImageSubject('Ferguson breaks silence on Man United'), 'Sir Alex Ferguson')
    assert.equal(resolveImageSubject('Sir Alex Ferguson turns 82'), 'Sir Alex Ferguson')
    assert.equal(topicLooksLikeCoach('Sir Alex Ferguson'), true)
    assert.equal(expandPlayerFullName('ferguson'), 'Sir Alex Ferguson')
    assert.equal(expandPlayerFullName('conte'), 'Antonio Conte')
  })

  it('normalizes Cuccorea typo to Marc Cucurella for image search + subject cues', () => {
    const topic = "Why Mark Cuccorea doesn't cut his hair"
    assert.match(normalizeFootballTopicQuery(topic), /Marc Cucurella/i)
    assert.doesNotMatch(normalizeFootballTopicQuery(topic), /Cuccorea/i)
    assert.match(sanitizeTopicForImageSearch(topic), /Cucurella/i)
    assert.equal(resolveImageSubject(topic), 'Marc Cucurella')
    assert.ok(
      hitMentionsSubject(topic, 'Marc Cucurella Chelsea long hair', 'https://cdn.example.com/cucurella.jpg'),
      'real Cucurella photo titles must match typo topics',
    )
    const kept = filterHitsRequiringSubjectNameCue(
      [
        {
          url: 'https://cdn.example.com/cucurella.jpg',
          title: 'Marc Cucurella of Chelsea with long hair',
          source: 'serpapi',
        },
      ],
      resolveImageSubject(topic),
      { log: false },
    )
    assert.equal(kept.length, 1)
  })

  it('does not glue club onto Cucurella required entity (Serp job query)', () => {
    // Regression: subject "Marc Cucurella" + query `"Marc Cucurella" Chelsea hair` produced
    // required entity "Marc Cucurella Chelsea" → contiguous includes() rejected real titles
    // like "Marc Cucurella of Chelsea with long hair" (score -2) → every scene placeholder.
    const entities = primaryImageEntities('Marc Cucurella', '"Marc Cucurella" Chelsea hair')
    assert.ok(
      entities.some((e) => /^marc cucurella$/i.test(e)),
      `expected person entity, got ${JSON.stringify(entities)}`,
    )
    assert.ok(
      !entities.some((e) => /cucurella\s+chelsea/i.test(e)),
      `club must not glue onto person: ${JSON.stringify(entities)}`,
    )
    assert.deepEqual(splitGluedPersonClubEntity('Marc Cucurella Chelsea'), [
      'Marc Cucurella',
      'Chelsea',
    ])

    const title = 'Marc Cucurella of Chelsea with long hair'
    const score = scoreImageRelevance('Marc Cucurella', title, '"Marc Cucurella" Chelsea hair', {
      intent: 'neutral',
      plainTextDraft: "Why Mark Cuccorea doesn't cut his hair",
    })
    assert.ok(score >= 2, `real Cucurella Serp title must score ≥2 for scene gate, got ${score}`)

    const topicScore = scoreImageRelevance(
      "Why Mark Cuccorea doesn't cut his hair",
      title,
      '"Marc Cucurella" Chelsea hair',
      { intent: 'neutral' },
    )
    assert.ok(topicScore >= 2, `topic+query score must accept real still, got ${topicScore}`)

    // Club-only titles must still hard-reject (Chelsea alone ≠ Cucurella).
    const clubOnly = scoreImageRelevance(
      'Marc Cucurella',
      'Chelsea star shows off flowing locks',
      '"Marc Cucurella" Chelsea hair',
      { intent: 'neutral' },
    )
    assert.ok(clubOnly < 0, `club-only title must not pass person gate, got ${clubOnly}`)
  })

  it('accepts realistic Cucurella Serp titles that the old glued-entity gate emptied', () => {
    const topic = "Why Mark Cuccorea doesn't cut his hair"
    const query = '"Marc Cucurella" Chelsea hair'
    const subject = resolveImageSubject(topic)
    const titles = [
      'Marc Cucurella of Chelsea FC celebrates',
      "Chelsea's Marc Cucurella with long hair",
      'Marc Cucurella Chelsea long hair',
    ]
    for (const title of titles) {
      const score = scoreImageRelevance(subject, title, query, {
        intent: 'neutral',
        plainTextDraft: topic,
      })
      assert.ok(score >= 2, `title must pass scene gate (≥2), got ${score} for “${title}”`)
      assert.ok(
        hitMentionsSubject(subject, title, 'https://cdn.example.com/photo.jpg'),
        `subject cue must match “${title}”`,
      )
    }
    // Old glued entity "Marc Cucurella Chelsea" must NOT be required as a contiguous string.
    assert.equal(
      entityMentionsInHaystack('Marc Cucurella Chelsea', 'marc cucurella of chelsea fc celebrates'),
      true,
      'split/part-wise match must accept “of Chelsea” titles',
    )
    const kept = filterHitsRequiringSubjectNameCue(
      titles.map((title, i) => ({
        url: `https://cdn.example.com/c${i}.jpg`,
        title,
        source: 'serpapi',
      })),
      subject,
      { log: false, query },
    )
    assert.equal(kept.length, titles.length, 'all real Cucurella titles must survive the pool filter')

    // Empty title + person query: keep (Google Images often omits title).
    const emptyKept = filterHitsRequiringSubjectNameCue(
      [{ url: 'https://cdn.example.com/anon.jpg', title: '', source: 'serpapi' }],
      subject,
      { log: false, query },
    )
    assert.equal(emptyKept.length, 1, 'empty-title hit from a person Serp query must be kept')
  })
})
