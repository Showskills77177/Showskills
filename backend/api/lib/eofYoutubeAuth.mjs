import { requireAdmin, verifyAdminSession, getAdminTokenFromReq } from './adminAuth.mjs'

function adminUsername() {
  return (process.env.ADMIN_USER || '').trim()
}

function editorUsername() {
  return (process.env.EOF_EDITOR_USER || '').trim()
}

export function isEofEditorLoginConfigured() {
  const user = editorUsername()
  const pass = (process.env.EOF_EDITOR_PASSWORD || '').trim()
  return Boolean(user && pass)
}

export function verifyEofEditorPassword(username, password) {
  const user = editorUsername()
  const pass = (process.env.EOF_EDITOR_PASSWORD || '').trim()
  if (!user || !pass) return false
  if (username !== user) return false
  return password === pass
}

/** Channel owner (ADMIN_USER) with full publish/schedule rights. */
export function isEofOwnerSession(payload) {
  if (!payload) return false
  if (payload.role === 'admin') {
    const sub = typeof payload.sub === 'string' ? payload.sub : adminUsername()
    return sub === adminUsername()
  }
  return false
}

export function isEofEditorSession(payload) {
  return payload?.role === 'eof_editor'
}

/** Owner or editor — can access EOF admin and submit editor uploads. */
export async function requireEofSession(req) {
  const token = getAdminTokenFromReq(req)
  const payload = await verifyAdminSession(token)
  if (!payload) {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }
  if (payload.role !== 'admin' && payload.role !== 'eof_editor') {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }
  return payload
}

/** Channel owner only — admin upload, approve, schedule, publish now. */
export async function requireEofOwner(req) {
  const payload = await requireEofSession(req)
  if (!isEofOwnerSession(payload)) {
    const err = new Error('Only the channel owner can perform this action.')
    err.statusCode = 403
    throw err
  }
  return payload
}

/** Main ShowSkills admin routes (unchanged). */
export { requireAdmin }

export function eofSessionInfo(payload) {
  const sub = typeof payload?.sub === 'string' ? payload.sub : adminUsername()
  return {
    username: sub || null,
    isOwner: isEofOwnerSession(payload),
    isEditor: isEofEditorSession(payload),
    canAdminUpload: isEofOwnerSession(payload),
    canApprove: isEofOwnerSession(payload),
  }
}
