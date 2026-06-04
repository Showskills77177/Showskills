import { SHIRT_GIVEAWAY_SOCIAL_PLATFORMS } from '../../shared/shirtGiveawayEntryRequirements.mjs'

/**
 * Shirt giveaway social follow — choose network, open profile in a new tab, enter handle, confirm.
 * @param {{
 *   socialLinks: Record<string, string>
 *   platform: string
 *   onPlatformChange: (id: string) => void
 *   handle: string
 *   onHandleChange: (value: string) => void
 *   followConfirmed: boolean
 *   onFollowConfirmedChange: (checked: boolean) => void
 * }} props
 */
export function ShirtGiveawaySocialFollow({
  socialLinks,
  platform,
  onPlatformChange,
  handle,
  onHandleChange,
  followConfirmed,
  onFollowConfirmedChange,
}) {
  const selected = SHIRT_GIVEAWAY_SOCIAL_PLATFORMS.find((p) => p.id === platform)
  const profileUrl = platform ? socialLinks[platform] : ''
  const handleTrimmed = handle.trim()

  function selectPlatform(id) {
    onPlatformChange(id)
    onFollowConfirmedChange(false)
  }

  return (
    <div className="rounded-xl border border-lime-500/20 bg-lime-950/15 p-3 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-lime-300/90">Social follow (required)</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        Choose one network, open our profile in a <strong className="text-stone-400">new tab</strong> to follow us, then
        come back here to enter your handle and confirm.
      </p>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Step 1 — Pick one network</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Social network to follow">
        {SHIRT_GIVEAWAY_SOCIAL_PLATFORMS.map(({ id, label }) => {
          const checked = platform === id
          const hasLink = Boolean(socialLinks[id])
          return (
            <div
              key={id}
              className={`rounded-lg border px-3 py-2.5 transition ${
                checked
                  ? 'border-lime-400/50 bg-lime-950/40 ring-1 ring-lime-500/25'
                  : 'border-white/10 bg-black/20'
              }`}
            >
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="kick-social-platform"
                  value={id}
                  checked={checked}
                  onChange={() => selectPlatform(id)}
                  className="h-4 w-4 shrink-0 border-white/20 bg-black/40 text-lime-500 focus:ring-lime-600/50"
                />
                <span className={checked ? 'font-semibold text-lime-100' : 'font-medium text-stone-300'}>{label}</span>
              </label>
              {!hasLink ? (
                <p className="mt-1 pl-6 text-[10px] text-amber-200/80">Link unavailable — pick another</p>
              ) : null}
            </div>
          )
        })}
      </div>

      {platform ? (
        <>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Step 2 — Follow us on {selected?.label || 'that network'}
          </p>
          {profileUrl ? (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-lime-400/40 bg-lime-950/50 px-4 py-3 text-center text-sm font-bold text-lime-100 shadow-sm transition hover:border-lime-300/60 hover:bg-lime-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400/70"
            >
              <span aria-hidden>↗</span>
              Open {selected?.label} profile in new tab
            </a>
          ) : (
            <p className="mt-2 rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
              Our {selected?.label} link is not set up right now. Choose TikTok or Instagram instead, or contact us for
              help.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
            Follow ShowSkills on that page, then return to this form to finish your entry.
          </p>

          <label htmlFor="modal-kick-social-handle" className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Step 3 — Your {selected?.label} username / handle
          </label>
          <input
            id="modal-kick-social-handle"
            type="text"
            autoComplete="off"
            disabled={!profileUrl}
            value={handle}
            onChange={(e) => onHandleChange(e.target.value)}
            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={platform === 'tiktok' ? '@yourname' : platform === 'instagram' ? '@yourname' : 'Your profile name'}
          />

          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={followConfirmed}
              onChange={(e) => onFollowConfirmedChange(e.target.checked)}
              disabled={!profileUrl || !handleTrimmed}
              className="mt-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Step 4 — </span>
              I have followed ShowSkills on <strong className="text-lime-100/90">{selected?.label}</strong> using the
              link above (required).
            </span>
          </label>
        </>
      ) : (
        <p className="mt-4 text-xs text-stone-500">Select TikTok, Instagram, or Facebook above to continue.</p>
      )}
    </div>
  )
}
