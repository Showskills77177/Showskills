import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { useUserAuth } from '../../auth/UserAuthProvider'
import { useEntryFlow } from '../../entry/entryContext'
import { useSiteLocale } from '../../i18n/SiteLocaleProvider.jsx'
import { EntryHistoryList } from './EntryHistoryList'

const inputClass =
  'w-full rounded-lg border border-lime-500/25 bg-lime-950/25 px-3 py-2.5 text-sm text-lime-50 outline-none focus:border-lime-400/60 focus:ring-1 focus:ring-lime-400/25'

function AddressFields({ prefix, values, onChange, t }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs text-lime-200/65">{t('auth.addressLine1')}</span>
        <input
          type="text"
          value={values.line1}
          onChange={(e) => onChange({ ...values, line1: e.target.value })}
          className={inputClass}
          autoComplete={`${prefix} address-line1`}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs text-lime-200/65">{t('auth.addressLine2')}</span>
        <input
          type="text"
          value={values.line2}
          onChange={(e) => onChange({ ...values, line2: e.target.value })}
          className={inputClass}
          autoComplete={`${prefix} address-line2`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-lime-200/65">{t('auth.city')}</span>
        <input
          type="text"
          value={values.city}
          onChange={(e) => onChange({ ...values, city: e.target.value })}
          className={inputClass}
          autoComplete={`${prefix} address-level2`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-lime-200/65">{t('auth.postcode')}</span>
        <input
          type="text"
          value={values.postcode}
          onChange={(e) => onChange({ ...values, postcode: e.target.value })}
          className={inputClass}
          autoComplete={`${prefix} postal-code`}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs text-lime-200/65">{t('auth.country')}</span>
        <input
          type="text"
          value={values.country}
          onChange={(e) => onChange({ ...values, country: e.target.value })}
          className={inputClass}
          autoComplete={`${prefix} country-name`}
        />
      </label>
    </div>
  )
}

const emptyAddress = () => ({ line1: '', line2: '', city: '', postcode: '', country: '' })

export function ProfileSettingsPanel() {
  const { refresh } = useUserAuth()
  const { openTerms } = useEntryFlow()
  const { t } = useSiteLocale()
  const [profile, setProfile] = useState(null)
  const [entries, setEntries] = useState([])
  const [entriesStatus, setEntriesStatus] = useState('loading')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([apiFetch('/api/auth/profile'), apiFetch('/api/auth/entries')])
      .then(async ([profileRes, entriesRes]) => {
        const profileData = await profileRes.json().catch(() => ({}))
        const entriesData = await entriesRes.json().catch(() => ({}))
        if (cancelled) return
        if (profileRes.ok) setProfile(profileData.profile)
        setEntries(Array.isArray(entriesData.entries) ? entriesData.entries : [])
        setEntriesStatus('ok')
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
          setEntriesStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function saveProfile(e) {
    e.preventDefault()
    if (!profile) return
    setError('')
    setInfo('')
    setSaving(true)
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profile.fullName,
          phone: profile.phone,
          address: profile.address,
          deliveryAddress: profile.deliveryAddress,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || t('form.networkError'))
        return
      }
      setProfile(data.profile)
      await refresh()
      setInfo(t('auth.profileSaved'))
    } catch {
      setError(t('form.networkError'))
    } finally {
      setSaving(false)
    }
  }

  async function onNewsletterToggle() {
    if (!profile) return
    setError('')
    setInfo('')
    const next = !profile.newsletterSubscribed
    try {
      const res = await apiFetch('/api/auth/newsletter', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || t('form.networkError'))
        return
      }
      setProfile((p) => ({ ...p, newsletterSubscribed: data.subscribed }))
      setInfo(next ? t('auth.newsletterOn') : t('auth.newsletterOff'))
    } catch {
      setError(t('form.networkError'))
    }
  }

  async function onChangePassword(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setPasswordSaving(true)
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || t('form.networkError'))
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setInfo(t('auth.passwordUpdated'))
    } catch {
      setError(t('form.networkError'))
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading || !profile) {
    return <p className="text-sm text-lime-200/55">{t('common.loading')}</p>
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-lg border border-lime-500/30 bg-lime-950/30 px-3 py-2 text-sm text-lime-200" role="status">
          {info}
        </p>
      ) : null}

      <form onSubmit={saveProfile} className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-lime-200/90">
            {t('auth.profileDetails')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-lime-200/65">{t('auth.fullName')}</span>
              <input
                type="text"
                required
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                className={inputClass}
                autoComplete="name"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-lime-200/65">{t('common.email')}</span>
              <input type="email" value={profile.email} readOnly className={`${inputClass} opacity-70`} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-lime-200/65">{t('auth.mobile')}</span>
              <input
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className={inputClass}
                autoComplete="tel"
              />
            </label>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-lime-200/90">
            {t('auth.address')}
          </h3>
          <AddressFields
            prefix="billing"
            values={profile.address || emptyAddress()}
            onChange={(address) => setProfile({ ...profile, address })}
            t={t}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-lime-200/90">
            {t('auth.deliveryAddress')}
          </h3>
          <AddressFields
            prefix="shipping"
            values={profile.deliveryAddress || emptyAddress()}
            onChange={(deliveryAddress) => setProfile({ ...profile, deliveryAddress })}
            t={t}
          />
        </section>
        </div>

        <section className="flex items-center justify-between gap-3 rounded-xl border border-lime-500/25 bg-lime-950/25 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{t('auth.newsletterToggle')}</p>
            <p className="text-xs text-lime-200/55">{t('auth.newsletterToggleHint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profile.newsletterSubscribed}
            onClick={onNewsletterToggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              profile.newsletterSubscribed ? 'bg-lime-500' : 'bg-stone-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                profile.newsletterSubscribed ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-lime-500 px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-lime-400 disabled:opacity-60"
        >
          {saving ? t('auth.savingProfile') : t('auth.saveProfile')}
        </button>
      </form>

      <section className="space-y-3 border-t border-lime-500/20 pt-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-lime-200/90">
          {t('auth.changePassword')}
        </h3>
        <form onSubmit={onChangePassword} className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-lime-200/65">{t('auth.currentPassword')}</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-lime-200/65">{t('auth.newPassword')}</span>
            <input
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-lime-200/65">{t('auth.confirmPassword')}</span>
            <input
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={passwordSaving}
            className="rounded-lg border border-lime-500/30 px-4 py-2 text-sm text-lime-50 transition hover:border-lime-400/50 hover:bg-lime-950/35 disabled:opacity-60 sm:col-span-2 sm:w-fit"
          >
            {passwordSaving ? t('auth.updatingPassword') : t('auth.updatePassword')}
          </button>
        </form>
      </section>

      <section className="space-y-3 border-t border-lime-500/20 pt-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-lime-200/90">
          {t('auth.helpAndLegal')}
        </h3>
        <p className="text-sm text-lime-200/55">{t('auth.helpAndLegalIntro')}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/faq"
            className="rounded-lg border border-lime-500/30 px-4 py-2 text-sm text-lime-50 transition hover:border-lime-400/50 hover:bg-lime-950/35"
          >
            {t('nav.faq')}
          </Link>
          <button
            type="button"
            onClick={() => openTerms()}
            className="rounded-lg border border-lime-500/30 px-4 py-2 text-sm text-lime-50 transition hover:border-lime-400/50 hover:bg-lime-950/35"
          >
            {t('nav.terms')}
          </button>
        </div>
      </section>

      <section className="space-y-3 border-t border-lime-500/20 pt-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-lime-200/90">
          {t('auth.entryHistory')}
        </h3>
        <EntryHistoryList entries={entries} entriesStatus={entriesStatus} />
      </section>
    </div>
  )
}
