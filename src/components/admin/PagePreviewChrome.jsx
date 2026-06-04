import showskillsLogo from '../../assets/showskills-logo.png'
import { mergeSiteShell } from '../../../shared/sitePageLayout.mjs'
import { offsetStyle } from '../../../shared/layoutOffsets.mjs'
import { FOOTER_NO_PURCHASE_NOTICE, POSTAL_ENTRY_ADDRESS } from '../../competitionData'
import { UK_AVAILABILITY_NOTICE } from '../../../shared/siteAvailability.mjs'
import { FooterSocialLinks } from '../FooterSocialLinks'
import { EditableDragFrame } from './EditableDragFrame'

function LogoMark({ className = 'h-8' }) {
  return (
    <div
      role="img"
      aria-hidden
      className={`w-auto shrink-0 bg-stone-100 [aspect-ratio:745/235] ${className}`}
      style={{
        maskImage: `url(${showskillsLogo})`,
        WebkitMaskImage: `url(${showskillsLogo})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}

function shellDragWrap({
  editorMode,
  id,
  label,
  offsets,
  offsetKey,
  selectedBlockId,
  onSelectBlock,
  onPatchShell,
  offsetField,
  scale = 1,
  children,
}) {
  const pos = offsets?.[offsetKey] || { x: 0, y: 0, scale }
  if (!editorMode) {
    const style = offsetStyle(pos, { scale, widthOnly: true })
    return style ? <div style={style}>{children}</div> : children
  }
  return (
    <EditableDragFrame
      id={id}
      label={label}
      x={pos.x}
      y={pos.y}
      scale={pos.scale ?? scale}
      selected={selectedBlockId === id}
      onSelect={onSelectBlock}
      widthOnly
      onChange={(patch) =>
        onPatchShell?.({
          [offsetField]: {
            ...offsets,
            [offsetKey]: { ...pos, ...patch },
          },
        })
      }
    >
      {children}
    </EditableDragFrame>
  )
}

/** Site header/footer shell for the visual page editor — matches public layout closely. */
export function PagePreviewChrome({
  shell: rawShell,
  highlight,
  onHighlight,
  fullscreen = false,
  selectedBlockId = null,
  onSelectBlock,
  onPatchShell,
  children,
}) {
  const shell = mergeSiteShell(rawShell)
  const navItems = shell.navOrder.map((id) => shell.navItems[id]).filter(Boolean)
  const footerLinks = (shell.footer?.linkOrder || [])
    .map((id) => shell.footer?.links?.[id])
    .filter(Boolean)
  const headerOffsets = shell.headerOffsets || {}
  const footerOffsets = shell.footerOffsets || {}
  const socialLinks = shell.footer?.socialLinks || {}

  const drag = (id, label, offsetKey, offsetField, node, scale) =>
    shellDragWrap({
      // Clean header/footer preview: apply stored offsets but do not show draggable handles.
      editorMode: false,
      id,
      label,
      offsets: offsetField === 'headerOffsets' ? headerOffsets : footerOffsets,
      offsetKey,
      selectedBlockId,
      onSelectBlock,
      onPatchShell,
      offsetField,
      scale,
      children: node,
    })

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden bg-[#050807] ${
        fullscreen ? 'h-full rounded-none border-0' : 'rounded-xl border border-white/10 shadow-inner'
      }`}
    >
      <div
        data-editor-section="site_header"
        className={`ss-header shrink-0 border-b border-white/[0.06] bg-[#071512]/95 px-4 py-2.5 transition ${
          highlight === 'header' ? 'ring-2 ring-inset ring-teal-400/60' : ''
        }`}
        onClick={() => onHighlight?.('header')}
        role={onHighlight ? 'button' : undefined}
        tabIndex={onHighlight ? 0 : undefined}
        onKeyDown={(e) => {
          if (onHighlight && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onHighlight('header')
          }
        }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          {drag(
            'header_nav',
            'Main menu',
            'nav',
            'headerOffsets',
            <nav className="hidden min-w-0 flex-wrap items-center justify-start gap-x-1 text-sm leading-normal sm:flex" aria-label="Preview navigation">
              {navItems
                .filter((item) => item.visible !== false)
                .map((item, i) => (
                  <span key={item.id} className="contents">
                    {i > 0 ? (
                      <span className="select-none text-stone-600" aria-hidden>
                        —
                      </span>
                    ) : null}
                    <span className="ss-desktop-nav-link rounded-md px-1.5 py-1 text-sm text-white opacity-90 transition hover:opacity-100">
                      {item.label}
                    </span>
                  </span>
                ))}
            </nav>,
          )}
          {drag(
            'header_logo',
            'Logo',
            'logo',
            'headerOffsets',
            <LogoMark className="h-10 sm:h-12 justify-self-center" />,
          )}
          {shell.showHeaderTagline !== false && shell.headerTagline
            ? drag(
                'header_tagline',
                'Tagline',
                'tagline',
                'headerOffsets',
                <p className="hidden justify-self-end -rotate-2 font-display text-lg font-bold tracking-[0.04em] text-white opacity-95 sm:block">
                  {shell.headerTagline}
                </p>,
              )
            : drag(
                'header_tagline',
                'Tagline',
                'tagline',
                'headerOffsets',
                <span className="hidden sm:block" aria-hidden />,
              )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#050807]">{children}</div>

      {shell.footer?.visible !== false ? (
        <div
          data-editor-section="site_footer"
          className={`ss-footer-bg sticky bottom-0 z-10 shrink-0 border-t border-white/[0.06] bg-[#071512] transition ${
            highlight === 'footer' ? 'ring-2 ring-inset ring-teal-400/60' : ''
          }`}
          onClick={() => onHighlight?.('footer')}
          role={onHighlight ? 'button' : undefined}
          tabIndex={onHighlight ? 0 : undefined}
          onKeyDown={(e) => {
            if (onHighlight && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onHighlight('footer')
            }
          }}
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-4 text-center">
            {shell.footer?.showLogo !== false
              ? drag('footer_logo', 'Footer logo', 'logo', 'footerOffsets', <LogoMark className="h-7" />)
              : null}
            {drag(
              'footer_links',
              'Footer links',
              'links',
              'footerOffsets',
              <nav className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-stone-400">
                {footerLinks
                  .filter((link) => link.visible !== false)
                  .map((link) => (
                    <span key={link.label}>{link.label}</span>
                  ))}
              </nav>,
            )}
            {shell.footer?.showSocial !== false
              ? drag(
                  'footer_social',
                  'Social links',
                  'social',
                  'footerOffsets',
                  <FooterSocialLinks links={socialLinks} preview={Boolean(onHighlight)} className="mt-2" />,
                )
              : null}
            {drag(
              'footer_legal',
              'Legal notice',
              'legal',
              'footerOffsets',
              <p className="mt-3 max-w-2xl text-xs leading-relaxed text-stone-500">
                {shell.footer?.legalNotice?.trim() || FOOTER_NO_PURCHASE_NOTICE}
              </p>,
            )}
            {shell.footer?.disclaimer
              ? drag(
                  'footer_disclaimer',
                  'Disclaimer',
                  'disclaimer',
                  'footerOffsets',
                  <p className="mt-3 text-xs text-stone-600">{shell.footer.disclaimer}</p>,
                )
              : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
