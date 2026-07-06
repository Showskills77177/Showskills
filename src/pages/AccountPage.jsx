import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { ProfileSettingsPanel } from '../components/auth/ProfileSettingsPanel'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

export default function AccountPage() {
  const { t } = useSiteLocale()

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="ss-site-container relative z-[1] px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <h1 className="font-display text-3xl uppercase tracking-[0.08em] text-white sm:text-4xl">
          {t('auth.profileSettings')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-lime-100/75">{t('auth.profilePageIntro')}</p>
        <div className="mt-8 w-full rounded-2xl border border-lime-500/30 bg-gradient-to-b from-lime-950/30 via-emerald-950/40 to-stone-950/55 p-6 shadow-[0_0_32px_rgba(132,204,22,0.1)] sm:p-8 lg:p-10">
          <ProfileSettingsPanel />
        </div>
      </div>
    </main>
  )
}
