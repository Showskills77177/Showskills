import { Link, Outlet } from 'react-router-dom'
import { AdminLogo } from '../admin/AdminLogo'

/** Standalone site editor shell — separate from the operations admin panel. */
export function EditorLayout() {
  return (
    <div className="ss-site-editor flex min-h-dvh flex-col bg-[#030504] text-stone-200">
      <header className="shrink-0 border-b border-white/10 bg-[#071512]/95">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <AdminLogo size="sm" />
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400/90">Site editor</span>
          </div>
          <Link
            to="/admin/dashboard"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-stone-400 hover:bg-white/5 hover:text-stone-200"
          >
            ← Back to admin
          </Link>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
