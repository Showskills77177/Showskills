import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AdminLogo } from './AdminLogo'
import { AdminThemePicker } from './AdminThemePicker'
import { useAdminTheme } from './AdminThemeContext'
import { adminThemeRootClass } from './adminThemes.mjs'
import { apiFetch } from '../lib/api'
import { isShowSkillsStagingClientEnabled } from '../../shared/stagingSite.mjs'
import { EYES_OF_FOOTBALL_ADMIN_PATH } from '../../shared/eyesOfFootball.mjs'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/site-visits', label: 'Site visits' },
  { to: '/admin/editor', label: 'Site editor' },
  { to: '/admin/competitions', label: 'Competitions' },
  { to: '/admin/giveaways', label: 'Giveaways' },
  { to: '/admin/world-cup-ball-draw', label: 'WC Ball draw', competition: 'shirt' },
  { to: '/admin/world-cup-ball-failed', label: 'WC failed', competition: 'shirt' },
  { to: '/admin/users', label: 'Users & entries', competition: 'legacy' },
  { to: '/admin/tickets', label: 'Tickets', competition: 'legacy' },
  { to: '/admin/draw', label: 'Draw winner', competition: 'legacy' },
  { to: '/admin/payments', label: 'Payments', competition: 'legacy' },
  { to: '/admin/submissions', label: 'Giveaway entries', competition: 'shirt' },
  { to: '/admin/entry-attempts', label: 'Entry log', competition: 'shirt' },
  { to: '/admin/test-email', label: 'Test email', competition: 'both' },
  { to: '/admin/newsletter', label: 'Newsletter', competition: 'both' },
]

const COMPETITION_TAG = {
  legacy: 'Main draw',
  shirt: 'Giveaway',
  both: 'All emails',
}

export function AdminLayout() {
  const navigate = useNavigate()
  const { theme } = useAdminTheme()

  const linkClass = ({ isActive }) =>
    `transition ${isActive ? theme.navActive : theme.navInactive}`

  async function logout() {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' })
    } catch {
      /* still leave */
    }
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className={adminThemeRootClass(theme)}>
      <header className={theme.header}>
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2.5">
            <div className="flex items-center gap-3">
              <AdminLogo size="sm" />
              <span className={`hidden sm:inline ${theme.adminBadge}`}>Admin</span>
            </div>
            <AdminThemePicker compact />
          </div>
          <nav className="flex flex-wrap items-center gap-2 py-3">
            {NAV_ITEMS.map(({ to, label, competition, end }) => (
              <NavLink key={to} to={to} className={linkClass} end={end ?? to === '/admin/dashboard'}>
                <span className="flex flex-col leading-tight">
                  <span>{label}</span>
                  {competition ? (
                    <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-75">
                      {COMPETITION_TAG[competition]}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
            {isShowSkillsStagingClientEnabled() ? (
              <NavLink to={EYES_OF_FOOTBALL_ADMIN_PATH} className={linkClass}>
                <span className="flex flex-col leading-tight">
                  <span>Eyes Of Football</span>
                  <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">
                    Staging · YouTube
                  </span>
                </span>
              </NavLink>
            ) : null}
            <button type="button" onClick={logout} className={theme.logoutBtn}>
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
