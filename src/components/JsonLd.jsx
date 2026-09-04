import { useEffect } from 'react'

let jsonLdCounter = 0

/**
 * Injects a `<script type="application/ld+json">` tag into <head> for the lifetime of the
 * component, and removes it on unmount. Renders nothing itself.
 *
 * @param {{ data: object | object[] }} props
 */
export function JsonLd({ data }) {
  useEffect(() => {
    if (!data) return undefined
    jsonLdCounter += 1
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = `ss-json-ld-${jsonLdCounter}`
    script.text = JSON.stringify(data)
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)])

  return null
}
