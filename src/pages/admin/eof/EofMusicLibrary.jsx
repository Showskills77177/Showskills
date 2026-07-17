import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiUrl } from '../../../lib/api'
import { productionJobStatusLabel } from '../../../../shared/eofProduction.mjs'
import { EOF } from './eofStudioTheme'

const inputCls = `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${EOF.input}`

export default function EofMusicLibrary({ onChanged }) {
  const [tracks, setTracks] = useState([])
  const [moods, setMoods] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    title: '',
    mood: 'neutral',
    publicUrl: '/eof/music/default-neutral.mp3',
    isDefault: true,
  })
  const [uploadFile, setUploadFile] = useState(null)

  const load = useCallback(async () => {
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-music-tracks')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load tracks')
      setTracks(j.tracks || [])
      setMoods(j.moods || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function registerPublicTrack(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/eof-music-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not add track')
      setForm((f) => ({ ...f, title: '' }))
      await load()
      onChanged?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function uploadTrack(e) {
    e.preventDefault()
    if (!uploadFile) return
    setBusy(true)
    setErr('')
    try {
      const fd = new FormData()
      fd.append('audio', uploadFile)
      fd.append('title', form.title || uploadFile.name)
      fd.append('mood', form.mood)
      if (form.isDefault) fd.append('isDefault', 'true')
      const res = await fetch(apiUrl('/api/admin/eof-music-upload'), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Upload failed (local API only)')
      setUploadFile(null)
      await load()
      onChanged?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function setDefault(id) {
    setBusy(true)
    try {
      const res = await apiFetch('/api/admin/eof-music-tracks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDefault: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Update failed')
      await load()
      onChanged?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`rounded-xl border ${EOF.panelBorder} ${EOF.panel} p-5`}>
      <h2 className="text-base font-semibold text-white">Music library</h2>
      <p className={`mt-1 text-xs ${EOF.muted}`}>
        Platform beds are loudness-mastered for Shorts (auto-balanced under VO on every Build / Remix).
        Prefer cleared / licensed MP3s. One default bed is mixed under narration on every render.
      </p>

      {err ? <p className="mt-3 text-sm text-[#ff4e45]">{err}</p> : null}

      <form onSubmit={registerPublicTrack} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[#aaa]">
          Title
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={inputCls}
            placeholder="Neutral bed"
            required
          />
        </label>
        <label className="block text-xs text-[#aaa]">
          Mood
          <select
            value={form.mood}
            onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
            className={inputCls}
          >
            {moods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#aaa] sm:col-span-2">
          Public URL (for Vercel — file in <code className="text-[#3ea6ff]">public/eof/music/</code>)
          <input
            value={form.publicUrl}
            onChange={(e) => setForm((f) => ({ ...f, publicUrl: e.target.value }))}
            className={inputCls}
            placeholder="/eof/music/my-track.mp3"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-[#aaa]">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
          />
          Default track for new videos
        </label>
        <button type="submit" disabled={busy} className={`rounded-full px-4 py-2 text-sm ${EOF.btnPrimary} disabled:opacity-50`}>
          Register track
        </button>
      </form>

      <form onSubmit={uploadTrack} className="mt-6 border-t border-[#303030] pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#717171]">Local upload (dev API)</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <input
            type="file"
            accept="audio/mpeg,audio/mp3"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="text-sm text-[#aaa]"
          />
          <button
            type="submit"
            disabled={busy || !uploadFile}
            className={`rounded-full px-4 py-2 text-sm border border-[#303030] text-white disabled:opacity-50`}
          >
            Upload MP3
          </button>
        </div>
      </form>

      <ul className="mt-6 space-y-2">
        {tracks.length === 0 ? (
          <li className={`text-sm ${EOF.muted}`}>No tracks yet — register your first YouTube Audio Library bed.</li>
        ) : (
          tracks.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#303030] px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-white">{t.title}</span>
                <span className={`ml-2 text-xs ${EOF.muted}`}>{t.mood}</span>
                {t.isDefault ? (
                  <span className="ml-2 rounded bg-[#2ba640]/20 px-2 py-0.5 text-[10px] text-[#6ee07d]">Default</span>
                ) : null}
                <p className="text-[10px] text-[#717171]">{t.publicUrl || t.storagePath}</p>
              </div>
              {!t.isDefault ? (
                <button type="button" onClick={() => setDefault(t.id)} className={`text-xs ${EOF.link}`}>
                  Set default
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
