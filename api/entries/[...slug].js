import { dispatch, pathFromRequest } from '../_dispatch.mjs'

export default async function handler(req, res) {
  return dispatch(req, res, pathFromRequest(req, '/api/entries'))
}
