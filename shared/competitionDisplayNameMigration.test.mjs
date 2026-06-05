import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyCompetitionDisplayNameReplacements,
  migrateCompetitionDisplayNameInJson,
  repairSignedLegacyBundlePrefix,
} from './competitionDisplayNameMigration.mjs'
import { DRAW_COMPETITION_LABEL } from './competitionPeriods.mjs'

describe('competitionDisplayNameMigration', () => {
  it('renames legacy bundle copy once', () => {
    assert.equal(
      applyCompetitionDisplayNameReplacements('Enter the Legacy Bundle draw below.'),
      `Enter the ${DRAW_COMPETITION_LABEL} draw below.`,
    )
  })

  it('does not double-prefix the canonical label', () => {
    const once = applyCompetitionDisplayNameReplacements(DRAW_COMPETITION_LABEL)
    assert.equal(once, DRAW_COMPETITION_LABEL)
    assert.equal(applyCompetitionDisplayNameReplacements(once), DRAW_COMPETITION_LABEL)
    assert.equal(
      applyCompetitionDisplayNameReplacements(`${DRAW_COMPETITION_LABEL} — pay online or enter free by post.`),
      `${DRAW_COMPETITION_LABEL} — pay online or enter free by post.`,
    )
  })

  it('repairs repeated Signed prefixes from earlier buggy backfills', () => {
    const corrupted = 'Signed Signed Signed Legacy Bundle details'
    assert.equal(repairSignedLegacyBundlePrefix(corrupted), `${DRAW_COMPETITION_LABEL} details`)
    assert.equal(
      applyCompetitionDisplayNameReplacements(corrupted),
      `${DRAW_COMPETITION_LABEL} details`,
    )
  })

  it('stays stable when applied repeatedly (serverless backfill)', () => {
    let text = `${DRAW_COMPETITION_LABEL} — pay online or enter free by post.`
    for (let i = 0; i < 5; i += 1) {
      text = applyCompetitionDisplayNameReplacements(text)
    }
    assert.equal(text, `${DRAW_COMPETITION_LABEL} — pay online or enter free by post.`)
  })

  it('migrates nested layout json without corrupting strings', () => {
    const input = {
      blocks: {
        hero_intro: { title: 'Legacy Bundle draw' },
        hero_details: { title: `${DRAW_COMPETITION_LABEL} details` },
      },
    }
    const once = migrateCompetitionDisplayNameInJson(input)
    assert.equal(once.blocks.hero_intro.title, `${DRAW_COMPETITION_LABEL} draw`)
    assert.equal(once.blocks.hero_details.title, `${DRAW_COMPETITION_LABEL} details`)
    assert.deepEqual(migrateCompetitionDisplayNameInJson(once), once)
  })
})
