import { dispatch, pathFromRequest } from '../lib/vercelApiDispatch.mjs'

/**
 * Single Vercel serverless function for all /api/* routes (Hobby plan: max 12 functions).
 * Do not add other api/*.js files — register routes in lib/vercelApiDispatch.mjs only.
 */
export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api'))
}
