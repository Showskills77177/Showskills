import { requireAdmin, verifyAdminSession, getAdminTokenFromReq } from '../lib/adminAuth.mjs'
import { eofSessionInfo } from '../lib/eofYoutubeAuth.mjs'
import { json } from '../lib/http.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const token = getAdminTokenFromReq(req)
  const payload = await verifyAdminSession(token)
  if (!payload) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (payload.role === 'eof_editor') {
    return json(res, 200, {
      ok: true,
      role: 'eof_editor',
      eofOnly: true,
      ...eofSessionInfo(payload),
    })
  }

  try {
    await requireAdmin(req)
    const eof =
      isShowSkillsStagingServerEnabled()
        ? { eyesOfFootball: { ...eofSessionInfo(payload), path: '/admin/eyes-of-football' } }
        : {}
    return json(res, 200, { ok: true, role: 'admin', ...eof })
  } catch (e) {
    const code = e.statusCode || 401
    return json(res, code, { error: 'Unauthorized' })
  }
}
