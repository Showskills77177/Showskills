import { query, dbIsPostgres } from './db.mjs'
import { DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'
import {
  LEGACY_SKILL_QUESTION_SEED,
  MAX_SKILL_QUESTIONS,
  normalizeSkillQuestionInput,
  publicSkillQuestions,
} from '../../../shared/competitionSkillQuestions.mjs'

let schemaEnsured = false

function parseAccepted(json) {
  if (Array.isArray(json)) return json
  if (typeof json === 'string') {
    try {
      const parsed = JSON.parse(json)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function mapRow(row) {
  return {
    questionKey: row.question_key,
    prompt: row.prompt,
    acceptedAnswers: parseAccepted(row.accepted_answers_json),
    sortOrder: Number(row.sort_order ?? 0),
  }
}

export async function ensureCompetitionSkillQuestionsSchema() {
  if (schemaEnsured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS competition_skill_questions (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        question_key TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        accepted_answers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (competition, question_key)
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS competition_skill_questions (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        question_key TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        accepted_answers_json TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (competition, question_key)
      )
    `)
  }

  await query(
    `CREATE INDEX IF NOT EXISTS idx_comp_skill_questions ON competition_skill_questions (competition, sort_order)`,
  )

  schemaEnsured = true
  await backfillLegacySkillQuestions()
}

async function backfillLegacySkillQuestions() {
  const existing = await query(
    `SELECT COUNT(*)::int AS c FROM competition_skill_questions WHERE competition = $1`,
    [DRAW_COMPETITION_SLUG],
  )
  if ((existing.rows[0]?.c ?? 0) > 0) return
  await replaceCompetitionSkillQuestions(DRAW_COMPETITION_SLUG, LEGACY_SKILL_QUESTION_SEED)
}

export async function listCompetitionSkillQuestions(competition, { includeAnswers = true } = {}) {
  await ensureCompetitionSkillQuestionsSchema()
  const r = await query(
    `SELECT * FROM competition_skill_questions WHERE competition = $1 ORDER BY sort_order ASC, question_key ASC`,
    [competition],
  )
  const rows = r.rows.map(mapRow)
  return includeAnswers ? rows : publicSkillQuestions(rows)
}

export async function replaceCompetitionSkillQuestions(competition, questionsInput) {
  await ensureCompetitionSkillQuestionsSchema()
  const list = Array.isArray(questionsInput) ? questionsInput : []
  if (list.length > MAX_SKILL_QUESTIONS) {
    return { ok: false, error: `Maximum ${MAX_SKILL_QUESTIONS} skill questions allowed.` }
  }

  const normalized = list
    .map((q, i) => normalizeSkillQuestionInput(q, i))
    .filter((q) => q.prompt)

  if (!normalized.length) {
    return { ok: false, error: 'Add at least one skill question with a prompt and acceptable answer(s).' }
  }

  for (const q of normalized) {
    if (!q.acceptedAnswers.length) {
      return {
        ok: false,
        error: `Question "${q.prompt.slice(0, 40)}…" needs at least one acceptable answer.`,
      }
    }
  }

  await query(`DELETE FROM competition_skill_questions WHERE competition = $1`, [competition])
  const now = new Date().toISOString()

  for (let i = 0; i < normalized.length; i += 1) {
    const q = normalized[i]
    const id = `${competition}:${q.questionKey}`
    const answersJson = JSON.stringify(q.acceptedAnswers)
    await query(
      `INSERT INTO competition_skill_questions (
        id, competition, question_key, prompt, accepted_answers_json, sort_order, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, competition, q.questionKey, q.prompt, answersJson, i, now],
    )
  }

  return { ok: true, questions: await listCompetitionSkillQuestions(competition) }
}

export async function resolveSkillValidation(competition, answers) {
  const { validateCompetitionSkillAnswers } = await import('../../../shared/competitionSkillQuestions.mjs')
  const { validatePaidSkillAnswers } = await import('../../../shared/paidSkillQuestions.mjs')

  const questions = await listCompetitionSkillQuestions(competition)
  if (questions.length) {
    return validateCompetitionSkillAnswers(questions, answers)
  }
  if (competition === DRAW_COMPETITION_SLUG) {
    return validatePaidSkillAnswers(answers.q1, answers.q2, answers.q3)
  }
  return { allCorrect: false, error: 'Skill challenge not configured for this competition.' }
}

export async function deleteCompetitionSkillQuestions(competition) {
  await ensureCompetitionSkillQuestionsSchema()
  await query(`DELETE FROM competition_skill_questions WHERE competition = $1`, [competition])
}

export function defaultSkillQuestionsForNewCompetition() {
  return LEGACY_SKILL_QUESTION_SEED.map((q, i) => ({
    ...q,
    acceptedAnswers: [...q.acceptedAnswers],
    sortOrder: i,
  }))
}
