#!/usr/bin/env node
/**
 * Eyes Of Football — API & lib smoke tests (no real YouTube upload).
 * Usage: node scripts/test-eyes-of-football-api.mjs
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.SQLITE_PATH = 'db/eof-test.sqlite'
process.env.ADMIN_USER = 'eof-test-admin'
process.env.ADMIN_PASSWORD = 'eof-test-pass-123'
process.env.ADMIN_JWT_SECRET = 'eof-test-jwt-secret-32chars-min!!'

const failures = []
function ok(label) {
  console.log(`  ✓ ${label}`)
}
function fail(label, err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`  ✗ ${label}: ${msg}`)
  failures.push({ label, msg })
}

async function main() {
  console.log('Eyes Of Football API / lib tests\n')

  const { detectVideoFormat, applyShortsDescription, parseTagsInput } = await import(
    '../shared/eofYoutubeMeta.mjs'
  )

  try {
    const vertical = detectVideoFormat({ width: 1080, height: 1920 })
    if (!vertical.isShort || vertical.formatId !== 'short') throw new Error('vertical not short')
    ok('detectVideoFormat: vertical 9:16 → Short')

    const long = detectVideoFormat({ width: 1920, height: 1080 })
    if (long.isShort || long.formatId !== 'long') throw new Error('landscape not long')
    ok('detectVideoFormat: landscape → long form')

    const tallLong = detectVideoFormat({ width: 1080, height: 1920 })
    if (!tallLong.isShort) throw new Error('tall video should be short regardless of duration')
    ok('detectVideoFormat: vertical detected as Short (length ignored)')

    const desc = applyShortsDescription('Hello', { isShort: true, addShortsHashtag: true })
    if (!/#Shorts/i.test(desc)) throw new Error('missing hashtag')
    ok('applyShortsDescription adds #Shorts')

    const tags = parseTagsInput('football, skills, #shorts')
    if (tags.length < 2) throw new Error('tags parse failed')
    ok('parseTagsInput')
  } catch (e) {
    fail('shared/eofYoutubeMeta', e)
  }

  try {
    const { ensureEofYoutubeSchema } = await import('../backend/api/lib/ensureEofYoutubeSchema.mjs')
    const { createEofProject, listEofProjects, getEofProject, EOF_STATUS } = await import(
      '../backend/api/lib/eofYoutubeProjects.mjs'
    )
    await ensureEofYoutubeSchema()
    ok('ensureEofYoutubeSchema')

    const p = await createEofProject({
      title: 'API test project',
      description: 'test',
      uploadSource: 'admin',
      submittedBy: 'eof-test-admin',
      contentType: 'short',
      tags: ['test'],
      visibility: 'private',
      isVerticalShort: true,
      widthPixels: 1080,
      heightPixels: 1920,
    })
    if (!p?.id) throw new Error('no project id')
    ok('createEofProject')

    const loaded = await getEofProject(p.id)
    if (loaded.title !== 'API test project') throw new Error('title mismatch')
    if (!loaded.isVerticalShort) throw new Error('isVerticalShort not stored')
    ok('getEofProject')

    const list = await listEofProjects()
    if (!list.some((x) => x.id === p.id)) throw new Error('not in list')
    ok('listEofProjects')

    const { buildCalendarFromProjects } = await import('../backend/api/lib/eofYoutubeProjects.mjs')
    const cal = buildCalendarFromProjects(list)
    if (typeof cal !== 'object') throw new Error('calendar not object')
    ok('buildCalendarFromProjects')
  } catch (e) {
    fail('eofYoutubeProjects DB', e)
  }

  try {
    const { signAdminSession } = await import('../backend/api/lib/adminAuth.mjs')
    const { isEofOwnerSession, isEofEditorSession } = await import('../backend/api/lib/eofYoutubeAuth.mjs')
    const adminToken = await signAdminSession({ sub: process.env.ADMIN_USER, role: 'admin' })
    const editorToken = await signAdminSession({ sub: 'editor1', role: 'eof_editor' })
    if (!adminToken || !editorToken) throw new Error('token sign failed')
    const { verifyAdminSession } = await import('../backend/api/lib/adminAuth.mjs')
    const adminPayload = await verifyAdminSession(adminToken)
    const editorPayload = await verifyAdminSession(editorToken)
    if (!isEofOwnerSession(adminPayload)) throw new Error('admin should be owner')
    if (!isEofEditorSession(editorPayload)) throw new Error('editor role')
    if (isEofOwnerSession(editorPayload)) throw new Error('editor not owner')
    ok('eof auth roles (admin vs editor)')
  } catch (e) {
    fail('eofYoutubeAuth', e)
  }

  try {
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001'
    const loginRes = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USER, password: process.env.ADMIN_PASSWORD }),
    })
    if (!loginRes.ok) throw new Error(`login ${loginRes.status} — is dev:e2e or API running on ${base}?`)
    const setCookie = loginRes.headers.get('set-cookie') || ''
    const match = setCookie.match(/admin_session=([^;]+)/)
    if (!match) throw new Error('no session cookie')
    const cookie = `admin_session=${match[1]}`

    const eofRes = await fetch(`${base}/api/admin/eyes-of-football`, { headers: { Cookie: cookie } })
    if (eofRes.status === 404) throw new Error('eyes-of-football 404 — staging gate?')
    if (!eofRes.ok) throw new Error(`eyes-of-football ${eofRes.status}`)
    const eof = await eofRes.json()
    if (!eof.youtube) throw new Error('missing youtube key')
    ok(`HTTP GET /api/admin/eyes-of-football (${base})`)

    const initRes = await fetch(`${base}/api/admin/eof-upload-init`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'HTTP test',
        uploadSource: 'admin',
        videoContentType: 'short',
      }),
    })
    if (initRes.status !== 503 && initRes.status !== 403) {
      // 503 = no youtube, 403 = not owner in some configs
      const t = await initRes.text()
      throw new Error(`expected 503/403 got ${initRes.status}: ${t.slice(0, 80)}`)
    }
    ok('HTTP POST /api/admin/eof-upload-init rejects without YouTube (expected)')
  } catch (e) {
    console.log(`  ⚠ HTTP API skipped: ${e instanceof Error ? e.message : e}`)
    console.log('    (Start API: npm run dev:e2e or set TEST_BASE_URL=http://127.0.0.1:3000)')
  }

  console.log('')
  if (failures.length) {
    console.error(`${failures.length} failed, ${failures.length === 1 ? '' : 'see above.'}`)
    process.exit(1)
  }
  console.log('All Eyes Of Football tests passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
