import { dispatch, pathFromRequest } from '../../lib/vercelApiDispatch.mjs'

/** Nested /api/youtube/* — OAuth callback for Eyes Of Football (staging). */
export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api/youtube'))
}
