import { Link, Outlet, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { EYES_OF_FOOTBALL_PRODUCT_NAME } from '../../shared/eyesOfFootball.mjs'

/** Minimal shell for Eyes Of Football — no ShowSkills logo or admin nav. */
export function EofAdminLayout() {
  const navigate = useNavigate()

  async function logout() {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' })
    } catch {
      /* still leave */
    }
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <header className="sticky top-0 z-20 border-b border-[#303030] bg-[#0f0f0f]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff0000]">
              {EYES_OF_FOOTBALL_PRODUCT_NAME}
            </p>
            <p className="truncate text-sm font-semibold text-white">YouTube Studio</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              to="/admin/dashboard"
              className="rounded-full border border-[#303030] bg-[#212121] px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#3ea6ff] hover:text-[#3ea6ff] sm:px-4 sm:text-sm"
            >
              ← Back to ShowSkills
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#aaaaaa] transition hover:bg-[#272727] hover:text-white sm:text-sm"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
