/**
 * Page controls for large admin lists (1, 2, 3 … with jump).
 */
export function AdminPagination({ page, totalPages, total, pageSize, onPageChange, disabled }) {
  if (!totalPages || totalPages < 1) return null

  const pages = buildPageList(page, totalPages)
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-2.5 py-2.5 text-sm text-stone-500">
      <p className="tabular-nums">
        {total ? (
          <>
            Showing <span className="text-stone-400">{from}–{to}</span> of{' '}
            <span className="text-stone-300">{total.toLocaleString()}</span>
          </>
        ) : (
          'No results'
        )}
      </p>
      <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
        <PageBtn label="Prev" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} />
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-stone-600">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(p)}
              className={`min-w-[1.75rem] rounded px-1.5 py-1 tabular-nums font-medium transition ${
                p === page
                  ? 'bg-amber-900/50 text-amber-100 ring-1 ring-amber-600/40'
                  : 'text-stone-400 hover:bg-white/5 hover:text-stone-200'
              }`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <PageBtn
          label="Next"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </nav>
    </div>
  )
}

function PageBtn({ label, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded px-2 py-1 font-medium text-stone-400 transition hover:bg-white/5 hover:text-stone-200 disabled:opacity-40"
    >
      {label}
    </button>
  )
}

function buildPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
    out.push(sorted[i])
  }
  return out
}
