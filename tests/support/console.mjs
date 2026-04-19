import { expect } from '@playwright/test'

/** Call returned function after navigation settles to assert no console error or uncaught page error. */
export function installPageErrorAsserter(page) {
  const errors = []
  const onConsole = (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
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
