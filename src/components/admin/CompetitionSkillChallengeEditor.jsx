import {
  LEGACY_SKILL_QUESTION_SEED,
  MAX_SKILL_QUESTIONS,
} from '../../../shared/competitionSkillQuestions.mjs'

const INPUT =
  'w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-stone-100'
const TEXTAREA =
  'w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-stone-100 font-mono text-xs'

export function emptySkillQuestionRow(index = 0) {
  return {
    questionKey: `q${index + 1}`,
    prompt: '',
    acceptedAnswers: [],
  }
}

export function legacySkillQuestionRows() {
  return LEGACY_SKILL_QUESTION_SEED.map((q, i) => ({
    questionKey: q.questionKey,
    prompt: q.prompt,
    acceptedAnswers: [...q.acceptedAnswers],
    sortOrder: i,
  }))
}

function answersToText(answers) {
  return (answers || []).join('\n')
}

function textToAnswers(text) {
  return String(text || '')
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * @param {{
 *   questions: Array<{ questionKey?: string, prompt: string, acceptedAnswers: string[] }>,
 *   onChange: (questions: Array) => void,
 *   compact?: boolean,
 * }} props
 */
export function CompetitionSkillChallengeEditor({ questions, onChange, compact = false }) {
  const rows = Array.isArray(questions) ? questions : []

  function updateRow(index, patch) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function updateAcceptedAnswers(index, text) {
    updateRow(index, { acceptedAnswers: textToAnswers(text) })
  }

  function removeRow(index) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function addRow() {
    if (rows.length >= MAX_SKILL_QUESTIONS) return
    onChange([...rows, emptySkillQuestionRow(rows.length)])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">
          Skill challenge questions shown during paid and free online entry. Entrants must answer every question;
          acceptable answers are matched flexibly (typos allowed). Up to {MAX_SKILL_QUESTIONS} questions.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(legacySkillQuestionRows())}
            className="rounded border border-white/15 px-2 py-1 text-xs text-stone-400 hover:bg-white/5"
          >
            Reset to Signed Football Legend template
          </button>
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= MAX_SKILL_QUESTIONS}
            className="rounded border border-teal-500/35 px-2 py-1 text-xs text-teal-100 hover:bg-teal-950/40 disabled:opacity-40"
          >
            Add question
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          Add at least one question with acceptable answers before publishing paid or free online entry.
        </p>
      ) : null}

      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={`${row.questionKey}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Question {index + 1}
                {!compact ? (
                  <span className="ml-2 font-mono normal-case text-stone-600">({row.questionKey || `q${index + 1}`})</span>
                ) : null}
              </p>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="text-xs text-red-400/90 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <label className="mt-2 block text-xs text-stone-400">
              Question prompt
              <textarea
                required
                rows={compact ? 2 : 3}
                value={row.prompt || ''}
                onChange={(e) => updateRow(index, { prompt: e.target.value })}
                placeholder="e.g. In which minute did Ronaldo score his first Premier League hat-trick?"
                className={`${INPUT} mt-1`}
              />
            </label>
            <label className="mt-2 block text-xs text-stone-400">
              Acceptable answers (one per line)
              <textarea
                required
                rows={compact ? 3 : 4}
                value={answersToText(row.acceptedAnswers)}
                onChange={(e) => updateAcceptedAnswers(index, e.target.value)}
                placeholder={'47\n47th\nforty seven'}
                className={`${TEXTAREA} mt-1`}
              />
            </label>
            <p className="mt-1 text-[10px] text-stone-600">
              {(row.acceptedAnswers || []).length} acceptable answer
              {(row.acceptedAnswers || []).length === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
