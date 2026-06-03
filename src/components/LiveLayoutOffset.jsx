/**
 * Wraps saved page-editor offsets on the live site.
 * CSS resets transforms on small viewports so mobile/tablet layouts stay readable.
 */
export function LiveLayoutOffset({ style, variant = 'layout', className = '', children }) {
  if (!style) return children
  const variantClass =
    variant === 'card'
      ? 'ss-live-card-offset'
      : variant === 'panel'
        ? 'ss-live-panel-offset'
        : 'ss-live-layout-offset'
  return (
    <div className={[variantClass, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  )
}
