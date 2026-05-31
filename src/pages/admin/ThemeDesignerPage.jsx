import { useAdminTheme } from '../../admin/AdminThemeContext'
import { adminThemeRootClass } from '../../admin/adminThemes.mjs'
import { AdminLogo } from '../../admin/AdminLogo'
import { AdminThemePicker } from '../../admin/AdminThemePicker'

export default function ThemeDesignerPage() {
  const { theme, themeId } = useAdminTheme()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-100">Theme designer</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">
          Choose how the admin panel looks for your session. Your choice is saved in this browser — other staff can pick
          their own theme. The public website is not affected.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Current theme: <strong className="text-stone-300">{theme.label}</strong>
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-stone-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Choose a design</h2>
        <div className="mt-4">
          <AdminThemePicker />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-stone-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Live preview</h2>
        <p className="mt-1 text-xs text-stone-500">Header and navigation as they appear with the selected theme.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className={`${theme.header} px-4 py-3`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-2.5">
              <div className="flex items-center gap-2">
                <AdminLogo linkTo={null} size="sm" />
                <span className={theme.adminBadge}>Admin</span>
              </div>
              <span className={theme.themePickerBtn}>
                <span className={theme.themePickerSelect}>{theme.label}</span>
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <span className={theme.navActive}>Dashboard</span>
              <span className={theme.navInactive}>Tickets</span>
              <span className={theme.navInactive}>Draw</span>
              <span className={theme.logoutBtn}>Log out</span>
            </div>
          </div>
          <div
            className={`px-4 py-6 ${
              theme.id === 'light' ? 'bg-white' : theme.id === 'pitch' ? 'bg-[#071512]' : 'bg-stone-950'
            }`}
          >
            <div className="rounded-xl border border-white/10 bg-stone-900/50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Sample stat</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-100">128</p>
              <p className="mt-2 text-xs text-stone-500">Preview card — tables and forms follow the same palette.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-stone-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Sign-in screen</h2>
        <p className="mt-1 text-xs text-stone-500">Login card and fields using the active theme tokens.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className={`${adminThemeRootClass(theme)} ${theme.loginOuter} !min-h-0 py-10`}>
            <div className={`${theme.loginCard} mx-auto w-full max-w-sm scale-[0.98]`}>
              <div className="mb-4 flex justify-center">
                <AdminLogo linkTo={null} size="md" />
              </div>
              <p className={theme.loginTitle}>Admin sign in</p>
              <div className="mt-4">
                <span className="block text-xs font-medium text-stone-400">Username</span>
                <div className={`${theme.input} pointer-events-none mt-1 opacity-90`} aria-hidden>
                  &nbsp;
                </div>
              </div>
              <div className="mt-3">
                <span className="block text-xs font-medium text-stone-400">Password</span>
                <div className={`${theme.input} pointer-events-none mt-1 opacity-90`} aria-hidden>
                  &nbsp;
                </div>
              </div>
              <div
                className="mt-4 min-h-[44px] rounded-xl bg-teal-700 py-2.5 text-center text-sm font-semibold text-white"
                aria-hidden
              >
                Sign in
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="text-xs text-stone-600">
        Theme id: <code className="font-mono text-stone-500">{themeId}</code> · stored in localStorage as{' '}
        <code className="font-mono text-stone-500">ss-admin-theme</code>
      </p>
    </div>
  )
}
