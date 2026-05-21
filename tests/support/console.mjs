import { expect } from '@playwright/test'

/** Third-party embeds (Trustpilot, fonts CDN) may log 403 in headless WebKit — not app bugs. */
const IGNORE_CONSOLE = [
  /Failed to load resource:.*\b403\b/i,
  /widget\.trustpilot\.com/i,
  /trustpilot/i,
]

function ignoreConsoleMessage(text) {
  return IGNORE_CONSOLE.some((re) => re.test(text))
}

/** Call returned function after navigation settles to assert no console error or uncaught page error. */
export function installPageErrorAsserter(page) {
  const errors = []
  const onConsole = (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (!ignoreConsoleMessage(text)) errors.push(`console.error: ${text}`)
    }
  }
  const onPageError = (err) => {
    errors.push(`pageerror: ${err.message}`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  return async () => {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    expect(errors, errors.join('\n')).toEqual([])
  }
}
