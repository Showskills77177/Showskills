const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
]

/** Footer social profile links from site shell config. */
export function FooterSocialLinks({ links, preview = false, className = '' }) {
  const items = PLATFORMS.filter((p) => String(links?.[p.id] || '').trim())
  if (!items.length) return null

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 ${className}`}>
      {items.map((p) =>
        preview ? (
          <span
            key={p.id}
            className="text-xs font-medium text-stone-500 underline decoration-stone-600 underline-offset-2"
          >
            {p.label}
          </span>
        ) : (
          <a
            key={p.id}
            href={links[p.id]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-stone-500 underline decoration-stone-600 underline-offset-2 transition hover:text-stone-300"
          >
            {p.label}
          </a>
        ),
      )}
    </div>
  )
}
