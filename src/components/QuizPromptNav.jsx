import { useEntryFlow } from '../entry/entryContext'

const BTN =
  'rounded-lg border px-2.5 py-1 text-xs font-bold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]'

export function QuizPromptNav({ className = '' }) {
  const { paidQuizNavStatus, openResumePaidQuiz } = useEntryFlow()

  if (paidQuizNavStatus === 'none') return null

  const isPending = paidQuizNavStatus === 'pending'
  const label = isPending ? 'Answer the questions' : 'Questions answered'

  return (
    <button
      type="button"
      onClick={openResumePaidQuiz}
      data-testid="quiz-prompt-nav"
      data-quiz-status={paidQuizNavStatus}
      className={`${BTN} ${className} ${
        isPending
          ? 'border-red-500/55 bg-red-950/50 text-red-200 hover:border-red-400/70 hover:bg-red-950/70 focus-visible:ring-red-500/50'
          : 'border-emerald-500/45 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400/60 hover:bg-emerald-950/60 focus-visible:ring-emerald-500/50'
      }`}
      aria-label={isPending ? 'Open skill questions — answers still required' : 'Open skill questions — already submitted'}
    >
      {label}
    </button>
  )
}
