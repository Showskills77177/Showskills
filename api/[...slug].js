import { dispatch, pathFromRequest } from './_dispatch.mjs'

/**
 * Single serverless entry for top-level /api/* routes (contact, payments, free entry, vpn-check).
 * Keeps Hobby deployments under Vercel's 12-function limit — do not add more api/*.js stubs.
 */
export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api'))
}
