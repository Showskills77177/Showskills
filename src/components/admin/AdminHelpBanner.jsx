/** Explains what an admin list represents (users vs quiz vs tickets, etc.). */
export function AdminHelpBanner({ title, children }) {
  return (
    <div className="rounded-lg border border-amber-800/25 bg-amber-950/25 px-3.5 py-2.5 text-sm leading-relaxed text-stone-400">
      {title ? <p className="mb-1 font-medium text-amber-100/95">{title}</p> : null}
      <p>{children}</p>
    </div>
  )
}

export const ADMIN_PAGE_SIZE = 40
