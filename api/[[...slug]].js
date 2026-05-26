import { dispatch, pathFromRequest } from '../lib/vercelApiDispatch.mjs'

/**
 * Flat /api/* routes (one path segment). Nested routes use prefix catch-alls:
 * api/entries/[...slug].js, api/admin/[...slug].js, api/submissions/[...slug].js
 * (Vercel optional catch-all does not match multi-segment paths.)
 * Register handlers in lib/vercelApiDispatch.mjs only.
 */
export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api'))
}
