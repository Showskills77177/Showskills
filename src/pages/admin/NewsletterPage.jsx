import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, apiUrl } from '../../lib/api'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { AdminHelpBanner, ADMIN_PAGE_SIZE } from '../../components/admin/AdminHelpBanner'
import { NewsletterEmailPreview } from '../../components/admin/NewsletterEmailPreview'
import { mergeEmailLayout, defaultEmailLayout } from '../../../shared/emailLayout.mjs'
import { campaignDefaultSubject } from '../../../shared/newsletterEmail.mjs'
import {
  CAMPAIGN_IMAGE_PLACEMENTS,
  defaultCampaignImage,
  normalizeCampaignImageWidth,
} from '../../../shared/newsletterCampaignImages.mjs'

const PLACEMENT_LABELS = {
  above: 'Above text',
  below: 'Below text',
  left: 'Left of text',
  right: 'Right of text',
}

function createCampaignImage(url, placement = 'above') {
  const base = defaultCampaignImage(url, placement)
  return { id: crypto.randomUUID(), ...base }
}

const HELP = {
  title: 'Newsletter subscribers',
  body: 'Everyone who opted in via the site footer, newsletter page, free shirt giveaway, or paid ticket checkout. Export CSV for Mailchimp/Brevo, or send a campaign through Resend. Email design matches ticket emails — edit templates in Site editor → Newsletter emails or preview on Test email.',
}

export default function AdminNewsletterPage() {
  const [status, setStatus] = useState('active')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [emailLayout, setEmailLayout] = useState(() => defaultEmailLayout())
  const [previewKind, setPreviewKind] = useState('campaign')
  const [campaignSubject, setCampaignSubject] = useState('')
  const [campaignHtml, setCampaignHtml] = useState('')
  const [campaignImages, setCampaignImages] = useState([])
  const [imageUrlDraft, setImageUrlDraft] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addingSubscriber, setAddingSubscriber] = useState(false)
  const [addResult, setAddResult] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [campaignResult, setCampaignResult] = useState('')

  useEffect(() => {
    apiFetch('/api/admin/site-pages')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) return
        const layout = mergeEmailLayout(j.pages?.emails)
        setEmailLayout(layout)
        setCampaignSubject(campaignDefaultSubject(layout))
        setCampaignHtml(layout.campaign?.bodyHtml || '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debounced, status])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(ADMIN_PAGE_SIZE),
        status,
      })
      if (debounced) qs.set('q', debounced)
      const res = await apiFetch(`/api/admin/newsletter-subscribers?${qs}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed')
      setRows(j.rows || [])
      setMeta({ total: j.total ?? 0, totalPages: j.totalPages ?? 1 })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [debounced, page, status])

  useEffect(() => {
    load()
  }, [load])

  function exportCsv() {
    const qs = new URLSearchParams({ export: 'csv', status })
    window.open(apiUrl(`/api/admin/newsletter-subscribers?${qs}`), '_blank', 'noopener')
  }

  async function sendCampaign({ testOnly }) {
    setSending(true)
    setCampaignResult('')
    setErr('')
    try {
      const res = await apiFetch('/api/admin/newsletter-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: campaignSubject,
          bodyHtml: campaignHtml,
          campaignImages,
          testEmail: testOnly ? testEmail : undefined,
          confirm: !testOnly,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Send failed')
      const parts = [
        `Sent: ${j.sent ?? 0}`,
        j.skipped ? `Skipped: ${j.skipped}` : null,
        j.emailTemplate ? `Template: ${j.emailTemplate}` : null,
        j.sandboxNote,
        j.errors?.length ? `Errors: ${j.errors.join('; ')}` : null,
      ].filter(Boolean)
      setCampaignResult(parts.join(' · '))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Campaign error')
    } finally {
      setSending(false)
    }
  }

  function addCampaignImageUrl(url) {
    const u = String(url || '').trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      setErr('Image URL must start with http:// or https://')
      return
    }
    setErr('')
    setCampaignImages((prev) => {
      if (prev.length >= 5 || prev.some((img) => img.url === u)) return prev
      return [...prev, createCampaignImage(u)]
    })
    setImageUrlDraft('')
  }

  function updateCampaignImage(id, patch) {
    setCampaignImages((prev) =>
      prev.map((img) => {
        if (img.id !== id) return img
        const placement = patch.placement ?? img.placement
        let width = img.width
        if (patch.placement && patch.placement !== img.placement) {
          width = normalizeCampaignImageWidth(undefined, placement)
        } else if (patch.width != null) {
          width = normalizeCampaignImageWidth(patch.width, placement)
        } else {
          width = normalizeCampaignImageWidth(img.width, placement)
        }
        return { ...img, ...patch, placement, width }
      }),
    )
  }

  async function uploadCampaignImage(file) {
    if (!file || campaignImages.length >= 5) return
    setUploadingImage(true)
    setErr('')
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await apiFetch('/api/admin/competition-upload', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Upload failed')
      if (j.url) addCampaignImageUrl(j.url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingImage(false)
    }
  }

  async function addSubscriber() {
    const email = addEmail.trim()
    if (!email) return
    setAddingSubscriber(true)
    setAddResult('')
    setErr('')
    try {
      const res = await apiFetch('/api/admin/newsletter-subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not add subscriber')
      setAddResult(`Added ${j.email}`)
      setAddEmail('')
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Add failed')
    } finally {
      setAddingSubscriber(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-stone-100">Newsletter</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/test-email"
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 hover:bg-white/5"
          >
            All email previews
          </Link>
          <Link
            to="/admin/editor?page=emails"
            className="rounded-lg border border-teal-500/40 px-3 py-2 text-sm text-teal-200 hover:bg-teal-950/40"
          >
            Edit email design
          </Link>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 hover:bg-white/5"
          >
            Export CSV
          </button>
        </div>
      </div>

      <AdminHelpBanner title={HELP.title} body={HELP.body} />

      <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Email design preview</h2>
        <p className="mt-1 text-xs text-stone-500">
          Same HTML preview as ticket emails. Inner campaign HTML below is wrapped in the branded shell when sent.
        </p>
        <div className="mt-4">
          <NewsletterEmailPreview
            layout={emailLayout}
            emailKind={previewKind}
            onEmailKindChange={setPreviewKind}
            campaignBodyHtml={campaignHtml}
            campaignImages={campaignImages}
          />
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Add subscriber</h2>
        <p className="mt-1 text-xs text-stone-500">Manually add or reactivate an email on the active list.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            type="email"
            placeholder="Email address"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200"
          />
          <button
            type="button"
            disabled={addingSubscriber || !addEmail.trim()}
            onClick={addSubscriber}
            className="rounded-lg border border-teal-500/40 px-3 py-2 text-sm font-medium text-teal-200 hover:bg-teal-950/40 disabled:opacity-50"
          >
            {addingSubscriber ? 'Adding…' : 'Add subscriber'}
          </button>
        </div>
        {addResult ? <p className="mt-2 text-sm text-emerald-300/90">{addResult}</p> : null}
      </section>

      <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Send campaign (Resend)</h2>
        <div className="mt-3 grid gap-3">
          <input
            type="text"
            placeholder="Subject (blank uses default from editor)"
            value={campaignSubject}
            onChange={(e) => setCampaignSubject(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200"
          />
          <label className="block text-xs text-stone-500">
            Message (plain text or HTML — line breaks are kept)
            <textarea
              rows={6}
              value={campaignHtml}
              onChange={(e) => setCampaignHtml(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-relaxed text-stone-200"
            />
          </label>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-medium text-stone-400">Campaign images (optional, up to 5)</p>
            <p className="mt-1 text-xs text-stone-500">
              Upload or paste a URL, then choose size and placement relative to your message.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="url"
                placeholder="https://…"
                value={imageUrlDraft}
                onChange={(e) => setImageUrlDraft(e.target.value)}
                className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200"
              />
              <button
                type="button"
                disabled={!imageUrlDraft.trim() || campaignImages.length >= 5}
                onClick={() => addCampaignImageUrl(imageUrlDraft)}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 hover:bg-white/5 disabled:opacity-50"
              >
                Add URL
              </button>
              <label className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 hover:bg-white/5 has-[:disabled]:opacity-50">
                {uploadingImage ? 'Uploading…' : 'Upload image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploadingImage || campaignImages.length >= 5}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) uploadCampaignImage(file)
                  }}
                />
              </label>
            </div>
            {campaignImages.length ? (
              <ul className="mt-3 space-y-3">
                {campaignImages.map((img) => {
                  const side = img.placement === 'left' || img.placement === 'right'
                  const minW = side ? 80 : 160
                  const maxW = side ? 220 : 472
                  return (
                    <li
                      key={img.id}
                      className="rounded-lg border border-white/10 bg-black/30 p-3"
                    >
                      <div className="flex flex-wrap gap-3">
                        <img src={img.url} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                        <div className="min-w-0 flex-1 space-y-3">
                          <p className="truncate font-mono text-xs text-stone-500">{img.url}</p>
                          <label className="block text-xs text-stone-400">
                            Placement
                            <select
                              value={img.placement}
                              onChange={(e) => updateCampaignImage(img.id, { placement: e.target.value })}
                              className="mt-1 block w-full max-w-xs rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-stone-200"
                            >
                              {CAMPAIGN_IMAGE_PLACEMENTS.map((p) => (
                                <option key={p} value={p}>
                                  {PLACEMENT_LABELS[p]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-xs text-stone-400">
                            Width: {img.width}px
                            <input
                              type="range"
                              min={minW}
                              max={maxW}
                              step={4}
                              value={img.width}
                              onChange={(e) => updateCampaignImage(img.id, { width: Number(e.target.value) })}
                              className="mt-1 block w-full max-w-xs"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCampaignImages((prev) => prev.filter((row) => row.id !== img.id))}
                          className="self-start text-xs text-red-300/90 hover:text-red-200"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="email"
              placeholder="Test inbox"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200"
            />
            <button
              type="button"
              disabled={sending || !testEmail.trim()}
              onClick={() => sendCampaign({ testOnly: true })}
              className="rounded-lg border border-teal-500/40 px-3 py-2 text-sm font-medium text-teal-200 hover:bg-teal-950/40 disabled:opacity-50"
            >
              Send test
            </button>
            <button
              type="button"
              disabled={sending || !campaignHtml.trim()}
              onClick={() => {
                if (
                  !window.confirm(
                    `Send "${campaignSubject || campaignDefaultSubject(emailLayout)}" to all active subscribers?`,
                  )
                ) {
                  return
                }
                sendCampaign({ testOnly: false })
              }}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send to all active'}
            </button>
          </div>
          {campaignResult ? <p className="text-sm text-emerald-300/90">{campaignResult}</p> : null}
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-stone-400">
          Status{' '}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ml-2 rounded border border-white/10 bg-black/30 px-2 py-1 text-stone-200"
          >
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="all">All</option>
          </select>
        </label>
        <input
          type="search"
          placeholder="Search email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200"
        />
      </div>

      {err ? <p className="text-sm text-red-300/90">{err}</p> : null}
      {loading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-white/10 bg-stone-900/60 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Subscribed</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id || row.email} className="border-b border-white/5">
                <td className="px-3 py-2 text-stone-200">{row.email}</td>
                <td className="px-3 py-2 text-stone-500">{row.source || '—'}</td>
                <td className="px-3 py-2 text-stone-500">{row.subscribedAt || '—'}</td>
                <td className="px-3 py-2">
                  {row.active ? (
                    <span className="text-emerald-400/90">Active</span>
                  ) : (
                    <span className="text-stone-500">Unsubscribed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-stone-500">No subscribers found.</p>
        ) : null}
      </div>

      <AdminPagination
        page={page}
        totalPages={meta.totalPages}
        pageSize={ADMIN_PAGE_SIZE}
        onPageChange={setPage}
        total={meta.total}
      />
    </div>
  )
}
