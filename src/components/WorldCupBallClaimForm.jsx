import { useState } from 'react'
import { EntryTermsConsent } from './EntryTermsConsent'
import { ErrorBanner } from './ErrorBanner'
import { apiUrl } from '../lib/api'
import { PHONE_COLLECTION_NOTICE } from '../../shared/contactPhone.mjs'
import { WORLD_CUP_BALL_PRIZE_TITLE } from '../../shared/worldCupBallGiveaway.mjs'
import {
  WORLD_CUP_BALL_FREE_SHIPPING_NOTICE,
  WORLD_CUP_BALL_MIN_AGE,
  WORLD_CUP_BALL_WINNER_EMAIL_REMINDER,
} from '../../shared/worldCupBallGiveawayRules.mjs'
import { WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY } from '../../shared/worldCupBallPhotography.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from '../../shared/siteContact.mjs'

/**
 * Winner fulfilment form — name, phone, and address collected only after a perfect score.
 */
export function WorldCupBallClaimForm({ claimToken, onOpenTerms, onClaimed, onError }) {
  const [entrantAgeBand, setEntrantAgeBand] = useState('18plus')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianAddressLine1, setGuardianAddressLine1] = useState('')
  const [guardianAddressLine2, setGuardianAddressLine2] = useState('')
  const [guardianCity, setGuardianCity] = useState('')
  const [guardianPostcode, setGuardianPostcode] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [localError, setLocalError] = useState('')

  const needsGuardian = entrantAgeBand === '16-17'

  const submit = async (e) => {
    e.preventDefault()
    setLocalError('')
    onError('')
    if (!consent) {
      setLocalError('Please agree to the Terms & Conditions and Privacy Policy.')
      return
    }
    if (!fullName.trim()) {
      setLocalError('Please enter your full name.')
      return
    }
    if (!email.trim().includes('@')) {
      setLocalError('Please enter a valid email address.')
      return
    }
    if (!phone.trim()) {
      setLocalError('Please enter your UK mobile number.')
      return
    }
    if (!addressLine1.trim() || !city.trim() || !postcode.trim()) {
      setLocalError('Please enter your full UK delivery address.')
      return
    }
    if (needsGuardian) {
      if (!guardianName.trim() || !guardianPhone.trim() || !guardianAddressLine1.trim() || !guardianCity.trim() || !guardianPostcode.trim()) {
        setLocalError('Please enter your parent or guardian’s full contact and UK delivery details.')
        return
      }
    }
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/submissions/world-cup-ball/claim'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          claimToken,
          entrantAgeBand,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          city: city.trim(),
          postcode: postcode.trim(),
          guardianName: guardianName.trim(),
          guardianPhone: guardianPhone.trim(),
          guardianAddressLine1: guardianAddressLine1.trim(),
          guardianAddressLine2: guardianAddressLine2.trim(),
          guardianCity: guardianCity.trim(),
          guardianPostcode: guardianPostcode.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : 'Could not save your details.'
        setLocalError(msg)
        onError(msg)
        return
      }
      onClaimed(
        data.winnerEmail && typeof data.winnerEmail === 'object'
          ? { ...data.winnerEmail, claimUrl: data.claimUrl || null, detailsComplete: true }
          : { sent: false, detailsComplete: true, claimUrl: data.claimUrl || null },
      )
    } catch {
      setLocalError('Could not save your details. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const sendClaimLink = async () => {
    setLocalError('')
    onError('')
    if (!email.trim().includes('@')) {
      setLocalError('Enter your email above first so we can send your winner link.')
      return
    }
    setLinkLoading(true)
    try {
      const res = await fetch(apiUrl('/api/submissions/world-cup-ball/send-claim-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ claimToken, email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : 'Could not send the email link.'
        setLocalError(msg)
        onError(msg)
        return
      }
      setLinkSent(true)
    } catch {
      setLocalError('Could not send the email link. Check your connection and try again.')
    } finally {
      setLinkLoading(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
      <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-sm text-amber-50/95">
        <p className="font-semibold text-amber-100">You won the {WORLD_CUP_BALL_PRIZE_TITLE}!</p>
        <p className="mt-2 text-stone-300">
          Complete this form now with your delivery details so we can ship your football.{' '}
          {WORLD_CUP_BALL_FREE_SHIPPING_NOTICE} You must be at least {WORLD_CUP_BALL_MIN_AGE} and a UK resident.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-amber-100/80">{WORLD_CUP_BALL_WINNER_EMAIL_REMINDER}</p>
      </div>

      <fieldset className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
        <legend className="px-1 text-sm font-medium text-stone-300">Your age</legend>
        <div className="mt-2 flex flex-col gap-2 text-sm text-stone-300">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="wc-ball-age"
              checked={entrantAgeBand === '18plus'}
              onChange={() => setEntrantAgeBand('18plus')}
              className="mt-1"
            />
            <span>I am 18 or over</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="wc-ball-age"
              checked={entrantAgeBand === '16-17'}
              onChange={() => setEntrantAgeBand('16-17')}
              className="mt-1"
            />
            <span>I am 16 or 17 (parent/guardian delivery details required below)</span>
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="wc-ball-name" className="block text-sm font-medium text-stone-300">
          Full name
        </label>
        <input
          id="wc-ball-name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
        />
      </div>
      <div>
        <label htmlFor="wc-ball-email" className="block text-sm font-medium text-stone-300">
          Email
        </label>
        <input
          id="wc-ball-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
          placeholder="you@example.com"
        />
        <p className="mt-2 text-xs leading-relaxed text-stone-500">
          We email your winner confirmation and a personal link to return to this form.
        </p>
      </div>
      <div>
        <label htmlFor="wc-ball-phone" className="block text-sm font-medium text-stone-300">
          Mobile / contact phone
        </label>
        <input
          id="wc-ball-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
          placeholder="e.g. 07XXX XXXXXX"
        />
        <p className="mt-2 text-xs leading-relaxed text-stone-500">{PHONE_COLLECTION_NOTICE}</p>
      </div>
      <div>
        <label htmlFor="wc-ball-line1" className="block text-sm font-medium text-stone-300">
          UK delivery address line 1
        </label>
        <input
          id="wc-ball-line1"
          type="text"
          autoComplete="address-line1"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
        />
      </div>
      <div>
        <label htmlFor="wc-ball-line2" className="block text-sm font-medium text-stone-300">
          Address line 2 <span className="text-stone-500">(optional)</span>
        </label>
        <input
          id="wc-ball-line2"
          type="text"
          autoComplete="address-line2"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wc-ball-city" className="block text-sm font-medium text-stone-300">
            Town / city
          </label>
          <input
            id="wc-ball-city"
            type="text"
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
          />
        </div>
        <div>
          <label htmlFor="wc-ball-postcode" className="block text-sm font-medium text-stone-300">
            Postcode
          </label>
          <input
            id="wc-ball-postcode"
            type="text"
            autoComplete="postal-code"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
          />
        </div>
      </div>

      {needsGuardian ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-950/15 p-4">
          <p className="text-sm font-semibold text-amber-100">Parent or legal guardian (delivery)</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-400">
            If you are 16 or 17, we ship to your parent or guardian&apos;s UK address using their contact details.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label htmlFor="wc-ball-guardian-name" className="block text-sm font-medium text-stone-300">
                Guardian full name
              </label>
              <input
                id="wc-ball-guardian-name"
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
              />
            </div>
            <div>
              <label htmlFor="wc-ball-guardian-phone" className="block text-sm font-medium text-stone-300">
                Guardian mobile
              </label>
              <input
                id="wc-ball-guardian-phone"
                type="tel"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
              />
            </div>
            <div>
              <label htmlFor="wc-ball-guardian-line1" className="block text-sm font-medium text-stone-300">
                Guardian address line 1
              </label>
              <input
                id="wc-ball-guardian-line1"
                type="text"
                value={guardianAddressLine1}
                onChange={(e) => setGuardianAddressLine1(e.target.value)}
                className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
              />
            </div>
            <div>
              <label htmlFor="wc-ball-guardian-line2" className="block text-sm font-medium text-stone-300">
                Guardian address line 2 <span className="text-stone-500">(optional)</span>
              </label>
              <input
                id="wc-ball-guardian-line2"
                type="text"
                value={guardianAddressLine2}
                onChange={(e) => setGuardianAddressLine2(e.target.value)}
                className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wc-ball-guardian-city" className="block text-sm font-medium text-stone-300">
                  Town / city
                </label>
                <input
                  id="wc-ball-guardian-city"
                  type="text"
                  value={guardianCity}
                  onChange={(e) => setGuardianCity(e.target.value)}
                  className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
                />
              </div>
              <div>
                <label htmlFor="wc-ball-guardian-postcode" className="block text-sm font-medium text-stone-300">
                  Postcode
                </label>
                <input
                  id="wc-ball-guardian-postcode"
                  type="text"
                  value={guardianPostcode}
                  onChange={(e) => setGuardianPostcode(e.target.value)}
                  className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-stone-500">
        {WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY} Photos may also be emailed to{' '}
        <a href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`} className="text-amber-400/90 underline">
          {SHOWSKILLS_CONTACT_EMAIL}
        </a>
        .
      </p>

      <EntryTermsConsent checked={consent} onChange={setConsent} onOpenTerms={onOpenTerms} variant="emerald" />
      {localError ? <ErrorBanner message={localError} /> : null}
      {linkSent ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2.5 text-xs text-emerald-100/90">
          Check your inbox — we sent a link to return to this delivery form when you are ready.
        </p>
      ) : null}
      <button
        type="button"
        disabled={linkLoading || loading}
        onClick={() => void sendClaimLink()}
        className="w-full rounded-xl border border-amber-500/35 bg-amber-950/30 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-900/30 disabled:opacity-50"
      >
        {linkLoading ? 'Sending link…' : 'Email me a link to finish later'}
      </button>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3 text-sm font-bold text-stone-950 hover:brightness-110 disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Confirm prize delivery details'}
      </button>
    </form>
  )
}
