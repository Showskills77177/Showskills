import { dispatch, pathFromRequest } from '../../../lib/vercelApiDispatch.mjs'

/** /api/submissions/world-cup-ball/* — parent catch-all only matches one segment after /api/submissions/. */
export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api/submissions/world-cup-ball'))
}
