import { dispatch, pathFromSlugParam } from '../_dispatch.mjs'

export default async function handler(req, res) {
  return dispatch(req, res, pathFromSlugParam('/api/records', req.query?.slug))
}
