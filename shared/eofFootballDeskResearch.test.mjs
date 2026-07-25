import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  filterDeskItemsToTopic,
  isOffTopicCrossSportDeskItem,
  normalizeFootballTopicQuery,
  seedKnownDeskNotesForTopic,
} from '../backend/api/lib/eofFootballDeskResearch.mjs'

describe('eofFootballDeskResearch topic lock', () => {
  const CUCCURELLA_TOPIC =
    'Marc Cuccurella hits back at long-hair criticism — says it is about his autistic son'

  it('normalizes Cuccorea typo to Cucurella for search', () => {
    assert.match(
      normalizeFootballTopicQuery("Why Mark Cuccorea doesn't cut his hair"),
      /Marc Cucurella/i,
    )
    assert.doesNotMatch(normalizeFootballTopicQuery("Why Mark Cuccorea doesn't cut his hair"), /Cuccorea/i)
  })

  it('seeds known Cucurella hair desk notes for typo topics', () => {
    const notes = seedKnownDeskNotesForTopic("Why Mark Cuccorea doesn't cut his hair")
    assert.match(notes, /Cucurella/i)
    assert.match(notes, /hair/i)
    assert.match(notes, /son|autistic/i)
  })

  it('matches Cucurella headlines when topic uses Cuccorea typo', () => {
    const items = [
      {
        title: 'Kevin Keegan reflects on World Player of the Year',
        description: 'career highlights',
      },
      {
        title: 'Cuccurella hits back at long hair critics over autistic son',
        description: 'Chelsea defender responds',
      },
    ]
    const kept = filterDeskItemsToTopic(items, "Why Mark Cuccorea doesn't cut his hair", {
      limit: 8,
    })
    assert.equal(kept.length, 1, JSON.stringify(kept))
    assert.match(kept[0].title, /Cuccurella|Cucurella/i)
  })

  it('drops Keegan / Fury headlines for a Cuccurella hair topic', () => {
    const items = [
      {
        title: 'Kevin Keegan reflects on World Player of the Year and I would love it',
        description: 'career highlights managerial England',
      },
      {
        title: 'Tyson Fury questions Anthony Joshua pride ahead of rematch',
        description: 'boxing heavyweight',
      },
      {
        title: 'Cuccurella hits back at long hair critics over autistic son',
        description: 'Chelsea defender responds',
      },
      {
        title: 'Premier League title race latest',
        description: 'Arsenal Liverpool',
      },
    ]
    const kept = filterDeskItemsToTopic(items, CUCCURELLA_TOPIC, { limit: 8 })
    assert.equal(kept.length, 1, JSON.stringify(kept))
    assert.match(kept[0].title, /Cuccurella/i)
  })

  it('flags boxing headlines as cross-sport when topic is football-only', () => {
    assert.equal(
      isOffTopicCrossSportDeskItem('Tyson Fury vs Anthony Joshua', CUCCURELLA_TOPIC),
      true,
    )
    assert.equal(
      isOffTopicCrossSportDeskItem('Cuccurella hair row after El Clasico', CUCCURELLA_TOPIC),
      false,
    )
  })

  it('allows boxing headlines when the ordered topic is already cross-sport', () => {
    const topic = 'Tyson Fury praises football graft after Joshua dig'
    assert.equal(isOffTopicCrossSportDeskItem('Fury questions Joshua pride', topic), false)
    const kept = filterDeskItemsToTopic(
      [{ title: 'Tyson Fury questions Anthony Joshua pride', description: 'boxing' }],
      topic,
      { limit: 4 },
    )
    assert.equal(kept.length, 1)
  })
})
