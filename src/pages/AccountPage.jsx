import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useUserAuth } from '../auth/UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

export default function AccountPage() {
  const { user, logout } = useUserAuth()
  const { t } = useSiteLocale()

  if (!user) return null

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl uppercase tracking-[0.08em] text-white sm:text-4xl">
          {t('auth.accountTitle')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-400">
          {t('auth.accountIntro', { email: user.email })}
        </p>

        <div className="mt-8 space-y-4 rounded-2xl border border-lime-500/25 bg-lime-950/20 p-5 sm:p-6">
          <div>
            <p className="text-sm text-stone-500">{t('auth.fullName')}</p>
            <p className="mt-1 text-lg text-white">{user.fullName}</p>
          </div>
          <div>
            <p className="text-sm text-stone-500">{t('common.email')}</p>
            <p className="mt-1 text-lg text-white">{user.email}</p>
          </div>

          <p className="text-sm leading-relaxed text-stone-400">{t('auth.newsletterSubscribed')}</p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/newsletter"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white transition hover:border-lime-500/40 hover:bg-white/5"
            >
              {t('auth.manageNewsletter')}
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
