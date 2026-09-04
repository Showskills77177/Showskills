import { dispatch, pathFromRequest } from '../../../lib/vercelApiDispatch.mjs'

/** /api/submissions/ronaldo-shirt-quiz/* — parent catch-all only matches one segment after /api/submissions/. */
export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api/submissions/ronaldo-shirt-quiz'))
}
