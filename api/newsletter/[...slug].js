import { dispatch, pathFromRequest } from '../../lib/vercelApiDispatch.mjs'

/** Nested /api/newsletter/* — Vercel flat catch-all only matches one segment under /api. */
export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api/newsletter'))
}
