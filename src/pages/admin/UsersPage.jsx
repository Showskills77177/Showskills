import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

export default function AdminUsersPage() {
  const [tab, setTab] = useState('users')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [users, setUsers] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ limit: '100' })
      if (debounced) qs.set('q', debounced)
      const [ur, er] = await Promise.all([
        apiFetch(`/api/admin/users?${qs}`),
        apiFetch(`/api/admin/entries?${qs}`),
      ])
      const uj = await ur.json().catch(() => ({}))
      const ej = await er.json().catch(() => ({}))
      if (!ur.ok) throw new Error(uj.error || 'Users failed')
      if (!er.ok) throw new Error(ej.error || 'Entries failed')
      setUsers(uj.rows || [])
      setEntries(ej.rows || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [debounced])

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
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-stone-100">Users &amp; entries</h1>
        <input
          type="search"
          placeholder="Search email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none"
        />
      </div>
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'users' ? 'bg-teal-900/40 text-teal-100' : 'text-stone-400 hover:bg-white/5'}`}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setTab('entries')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'entries' ? 'bg-teal-900/40 text-teal-100' : 'text-stone-400 hover:bg-white/5'}`}
        >
          Quiz entries
        </button>
      </div>
      {err ? <p className="text-red-400">{err}</p> : null}
      {loading ? <p className="text-stone-500">Loading…</p> : null}
      {!loading && tab === 'users' ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-stone-900/80 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Entries</th>
                <th className="px-3 py-2">Tickets</th>
                <th className="px-3 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2 text-stone-200">{u.full_name}</td>
                  <td className="px-3 py-2 text-stone-400">{u.email}</td>
                  <td className="px-3 py-2 tabular-nums text-stone-300">{u.entries_count}</td>
                  <td className="px-3 py-2 tabular-nums text-stone-300">{u.tickets_count}</td>
                  <td className="px-3 py-2 text-stone-500">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length ? <p className="p-4 text-stone-500">No users yet.</p> : null}
        </div>
      ) : null}
      {!loading && tab === 'entries' ? (
        <div className="space-y-4">
          {entries.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-white/10 bg-stone-900/40 p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-stone-200">{row.full_name || '—'}</p>
                  <p className="text-stone-500">{row.email || '—'}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {row.competition} · {row.entry_type} · {formatDate(row.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-300">
                    Auto-correct: {row.all_correct == null ? '—' : row.all_correct ? 'yes' : 'no'}
                  </span>
                  <span className="rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-300">
                    Valid: {row.reviewed_valid == null ? 'unset' : row.reviewed_valid ? 'yes' : 'no'}
                  </span>
                </div>
              </div>
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-stone-400">
                {JSON.stringify(row.answers_json ?? {}, null, 2)}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                  onClick={() => patchEntry(row.id, { reviewed_valid: true })}
                >
                  Mark valid
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                  onClick={() => patchEntry(row.id, { reviewed_valid: false })}
                >
                  Mark invalid
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                  onClick={() => patchEntry(row.id, { all_correct: true })}
                >
                  Set all correct
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5"
                  onClick={() => patchEntry(row.id, { all_correct: false })}
                >
                  Set not all correct
                </button>
              </div>
            </article>
          ))}
          {!entries.length ? <p className="text-stone-500">No competition entries yet.</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}
