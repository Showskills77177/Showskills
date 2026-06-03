import { resolvedSocialLinks } from '../../shared/socialLinks.mjs'

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
]

function TikTokIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 2.59-2.59c.28 0 .54.04.79.1v-3.1a5.69 5.69 0 0 0-.79-.05 5.69 5.69 0 0 0-5.69 5.69 5.69 5.69 0 0 0 5.69 5.69 5.69 5.69 0 0 0 5.69-5.69V8.56a7.27 7.27 0 0 0 4.3 1.38V6.85a4.28 4.28 0 0 1-1-.03z" />
    </svg>
  )
}

function InstagramIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </svg>
  )
}

function FacebookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M13.5 22v-8h2.75l.42-3.25H13.5V9.02c0-.94.26-1.58 1.62-1.58h1.73V4.4c-.3-.04-1.33-.13-2.53-.13-2.5 0-4.26 1.53-4.26 4.33V11H7v3.25h2.06v8h4.44z" />
    </svg>
  )
}

const ICONS = {
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
}

const ICON_BTN =
  'inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-stone-400 transition hover:border-lime-400/35 hover:bg-lime-950/30 hover:text-lime-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400/60'

const ICON_SIZES = {
  default: { btn: 'h-11 w-11', icon: 'h-5 w-5', gap: 'gap-3' },
  compact: { btn: 'h-9 w-9', icon: 'h-4 w-4', gap: 'gap-2' },
}

function footerLinksForResolve(links) {
  if (!links || typeof links !== 'object') return links
  const out = { ...links }
  for (const key of ['tiktok', 'instagram', 'facebook']) {
    if (typeof out[key] === 'string' && !out[key].trim()) delete out[key]
  }
  return out
}

/** Footer social profile links from site shell config (icon buttons). */
export function FooterSocialLinks({ links, preview = false, className = '', size = 'default' }) {
  const resolved = resolvedSocialLinks(footerLinksForResolve(links))
  const items = PLATFORMS.filter((p) => resolved[p.id])
  const sz = ICON_SIZES[size] || ICON_SIZES.default

  if (!items.length) return null

  return (
    <div className={`flex flex-wrap items-center justify-center ${sz.gap} ${className}`} role="list">
      {items.map((p) => {
        const Icon = ICONS[p.id]
        const href = resolved[p.id]
        const btnClass = `${ICON_BTN} ${sz.btn} ${preview ? 'cursor-default opacity-70' : ''}`
        if (preview) {
          return (
            <span key={p.id} role="listitem" className={btnClass} title={p.label}>
              <Icon className={sz.icon} />
              <span className="sr-only">{p.label}</span>
            </span>
          )
        }
        return (
          <a
            key={p.id}
            role="listitem"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={btnClass}
            title={`ShowSkills on ${p.label}`}
            aria-label={`ShowSkills on ${p.label} (opens in new tab)`}
          >
            <Icon className={sz.icon} />
          </a>
        )
      })}
    </div>
  )
}
