import { Fragment, useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { AdminHelpBanner, ADMIN_PAGE_SIZE } from '../../components/admin/AdminHelpBanner'
import { USERS_TAB_HELP } from '../../../shared/adminListCopy.mjs'

export default function AdminUsersPage() {
  const [tab, setTab] = useState('users')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [entriesPage, setEntriesPage] = useState(1)
  const [users, setUsers] = useState([])
  const [entries, setEntries] = useState([])
  const [usersMeta, setUsersMeta] = useState({ total: 0, totalPages: 1 })
  const [entriesMeta, setEntriesMeta] = useState({ total: 0, totalPages: 1 })
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setUsersPage(1)
    setEntriesPage(1)
  }, [debounced])

  const loadUsers = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(usersPage),
      pageSize: String(ADMIN_PAGE_SIZE),
    })
    if (debounced) qs.set('q', debounced)
    const res = await apiFetch(`/api/admin/users?${qs}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || 'Users failed')
    setUsers(j.rows || [])
    setUsersMeta({ total: j.total ?? 0, totalPages: j.totalPages ?? 1 })
  }, [debounced, usersPage])

  const loadEntries = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(entriesPage),
      pageSize: String(ADMIN_PAGE_SIZE),
    })
    if (debounced) qs.set('q', debounced)
    const res = await apiFetch(`/api/admin/entries?${qs}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || 'Entries failed')
    setEntries(j.rows || [])
    setEntriesMeta({ total: j.total ?? 0, totalPages: j.totalPages ?? 1 })
  }, [debounced, entriesPage])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      if (tab === 'users') await loadUsers()
      else await loadEntries()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [tab, loadUsers, loadEntries])

  useEffect(() => {
    load()
  }, [load])

  async function patchEntry(id, body) {
    const res = await apiFetch('/api/admin/entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Update failed')
      return
    }
    await loadEntries()
  }

  const activePage = tab === 'users' ? usersPage : entriesPage
  const activeMeta = tab === 'users' ? usersMeta : entriesMeta
  const setActivePage = tab === 'users' ? setUsersPage : setEntriesPage
  const tabHelp = tab === 'users' ? USERS_TAB_HELP.users : USERS_TAB_HELP.entries

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-stone-100">Users &amp; entries</h1>
        <input
          type="search"
          placeholder="Search email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none"
        />
      </div>

      <AdminHelpBanner title={tabHelp.title}>{tabHelp.body}</AdminHelpBanner>

      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'users' ? 'bg-teal-900/40 text-teal-100' : 'text-stone-400 hover:bg-white/5'}`}
        >
          Users
          {usersMeta.total ? (
            <span className="ml-1.5 tabular-nums text-stone-500">({usersMeta.total.toLocaleString()})</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setTab('entries')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'entries' ? 'bg-teal-900/40 text-teal-100' : 'text-stone-400 hover:bg-white/5'}`}
        >
          Quiz entries
          {entriesMeta.total ? (
            <span className="ml-1.5 tabular-nums text-stone-500">({entriesMeta.total.toLocaleString()})</span>
          ) : null}
        </button>
      </div>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {loading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {!loading && tab === 'users' ? (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/90 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-2.5 py-2 font-medium">Name</th>
                  <th className="px-2.5 py-2 font-medium">Email</th>
                  <th className="px-2.5 py-2 font-medium">Quiz entries</th>
                  <th className="px-2.5 py-2 font-medium">Tickets</th>
                  <th className="px-2.5 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.03]">
                    <td className="max-w-[11rem] truncate px-2.5 py-2 font-medium text-stone-200">
                      {u.full_name || '—'}
                    </td>
                    <td className="max-w-[14rem] truncate px-2.5 py-2 text-stone-400">{u.email}</td>
                    <td className="px-2.5 py-2 tabular-nums text-stone-300">{u.entries_count}</td>
                    <td className="px-2.5 py-2 tabular-nums text-stone-300">{u.tickets_count}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-stone-500">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!users.length ? <p className="px-3 py-4 text-sm text-stone-500">No users yet.</p> : null}
          <AdminPagination
            page={activePage}
            totalPages={activeMeta.totalPages}
            total={activeMeta.total}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setActivePage}
            disabled={loading}
          />
        </div>
      ) : null}

      {!loading && tab === 'entries' ? (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/10 bg-stone-900/90 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-2.5 py-2 font-medium">Name</th>
                  <th className="px-2.5 py-2 font-medium">Email</th>
                  <th className="px-2.5 py-2 font-medium">Type</th>
                  <th className="px-2.5 py-2 font-medium">Auto-correct</th>
                  <th className="px-2.5 py-2 font-medium">Valid</th>
                  <th className="px-2.5 py-2 font-medium">When</th>
                  <th className="px-2.5 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((row) => {
                  const open = expandedId === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr className="hover:bg-white/[0.03]">
                        <td className="max-w-[9rem] truncate px-2.5 py-2 font-medium text-stone-200">
                          {row.full_name || '—'}
                        </td>
                        <td className="max-w-[12rem] truncate px-2.5 py-2 text-stone-400">{row.email || '—'}</td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-stone-500">{row.entry_type}</td>
                        <td className="px-2.5 py-2">
                          <BoolPill value={row.all_correct} />
                        </td>
                        <td className="px-2.5 py-2">
                          <BoolPill value={row.reviewed_valid} unsetLabel="unset" />
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-stone-500">{formatDate(row.created_at)}</td>
                        <td className="px-2.5 py-2">
                          <div className="flex flex-wrap gap-1">
                            <MiniBtn onClick={() => setExpandedId(open ? null : row.id)}>
                              {open ? 'Hide' : 'Answers'}
                            </MiniBtn>
                            <MiniBtn onClick={() => patchEntry(row.id, { reviewed_valid: true })}>Valid</MiniBtn>
                            <MiniBtn onClick={() => patchEntry(row.id, { reviewed_valid: false })}>Invalid</MiniBtn>
                          </div>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-black/25">
                          <td colSpan={7} className="px-2.5 py-2">
                            <pre className="max-h-28 overflow-auto rounded bg-black/40 p-2 font-mono text-xs leading-snug text-stone-400">
                              {JSON.stringify(row.answers_json ?? {}, null, 2)}
                            </pre>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <MiniBtn onClick={() => patchEntry(row.id, { all_correct: true })}>Set all correct</MiniBtn>
                              <MiniBtn onClick={() => patchEntry(row.id, { all_correct: false })}>Set not correct</MiniBtn>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!entries.length ? <p className="px-3 py-4 text-sm text-stone-500">No competition entries yet.</p> : null}
          <AdminPagination
            page={activePage}
            totalPages={activeMeta.totalPages}
            total={activeMeta.total}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setActivePage}
            disabled={loading}
          />
        </div>
      ) : null}
    </div>
  )
}

function BoolPill({ value, unsetLabel = '—' }) {
  if (value == null) {
    return <span className="text-stone-600">{unsetLabel}</span>
  }
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
        value ? 'bg-emerald-950/80 text-emerald-300' : 'bg-red-950/60 text-red-300'
      }`}
    >
      {value ? 'yes' : 'no'}
    </span>
  )
}

function MiniBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-white/10 px-2 py-0.5 text-xs text-stone-400 transition hover:bg-white/5 hover:text-stone-200"
    >
      {children}
    </button>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}
