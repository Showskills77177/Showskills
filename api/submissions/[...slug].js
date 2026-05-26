import { dispatch, pathFromRequest } from '../../lib/vercelApiDispatch.mjs'

/** Nested /api/submissions/* — Vercel optional catch-all only matches one segment. */
export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api/submissions'))
}
