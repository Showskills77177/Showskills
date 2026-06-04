/** Rubber-stamp badge — clarifies Signed Legacy Bundle prizes are collectibles, not official merch. */
export function LegacyBundleCollectiblesStamp({ className = '', size = 'md' }) {
  const sizes = {
    sm: 'px-1 py-px text-[8px] tracking-[0.1em]',
    md: 'px-1.5 py-0.5 text-[9px] tracking-[0.12em] sm:text-[10px]',
    lg: 'px-2 py-0.5 text-[10px] tracking-[0.14em] sm:text-[11px]',
  }

  return (
    <span
      className={`inline-flex shrink-0 -rotate-3 scale-[0.97] items-center rounded-sm border border-dashed border-[rgba(212,175,55,0.55)] bg-gradient-to-br from-[#3a2d0c] via-[#2a2008] to-[#1a1405] font-sans font-semibold normal-case text-[#f0e6c8] shadow-[inset_0_1px_0_rgba(218,185,90,0.18),inset_0_0_0_1px_rgba(160,130,40,0.3),0_2px_6px_rgba(0,0,0,0.45)] ${sizes[size] || sizes.md} ${className}`.trim()}
      title="Rare collectibles — not official licensed merchandise"
    >
      Collectibles
    </span>
  )
}
