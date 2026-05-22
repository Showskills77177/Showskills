import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AdminLogo } from './AdminLogo'
import { apiFetch } from '../lib/api'

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-teal-900/50 text-teal-100' : 'text-stone-400 hover:bg-white/5 hover:text-stone-200'
  }`

export function AdminLayout() {
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
    <div className="min-h-screen bg-stone-950 text-stone-200">
      <header className="border-b border-white/10 bg-stone-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <AdminLogo size="sm" />
            <span className="hidden text-xs font-medium uppercase tracking-wider text-stone-500 sm:inline">Admin</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/admin/dashboard" className={linkClass} end={false}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/users" className={linkClass}>
              Users &amp; entries
            </NavLink>
            <NavLink to="/admin/tickets" className={linkClass}>
              Tickets
            </NavLink>
            <NavLink to="/admin/draw" className={linkClass}>
              Draw winner
            </NavLink>
            <NavLink to="/admin/entry-attempts" className={linkClass}>
              Entry log
            </NavLink>
            <NavLink to="/admin/payments" className={linkClass}>
              Payments
            </NavLink>
            <NavLink to="/admin/submissions" className={linkClass}>
              Kick-up videos
            </NavLink>
            <NavLink to="/admin/test-email" className={linkClass}>
              Test email
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="ml-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 hover:bg-white/5"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
