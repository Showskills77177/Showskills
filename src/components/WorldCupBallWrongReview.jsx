/**
 * Lists questions the entrant answered incorrectly after a failed quiz attempt.
 */
export function WorldCupBallWrongReview({ wrongReview = [], className = '' }) {
  if (!Array.isArray(wrongReview) || wrongReview.length === 0) return null

  return (
    <div className={`mt-3 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-3 ${className}`.trim()}>
      <p className="text-xs font-semibold uppercase tracking-wide text-red-200/90">Questions you missed</p>
      <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-stone-300">
        {wrongReview.map((row) => (
          <li key={row.questionKey}>
            <p className="font-medium text-stone-200">{row.prompt}</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Your answer: <span className="text-red-200/90">{row.yourAnswer}</span>
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
