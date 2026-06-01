import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { PERIOD_STATUS, PERIOD_STATUS_LABELS, formatPeriodMonthLabel } from '../../../shared/competitionPeriods.mjs'
import {
  CompetitionBundleEditor,
  standardBundleRows,
} from '../../components/admin/CompetitionBundleEditor'
import { CompetitionEntryMethodsEditor } from '../../components/admin/CompetitionEntryMethodsEditor'
import {
  CompetitionSkillChallengeEditor,
  legacySkillQuestionRows,
} from '../../components/admin/CompetitionSkillChallengeEditor'
import { defaultEntryMethodsForNewCompetition, defaultEntryMethodsForNewGiveaway } from '../../../shared/competitionEntryMethods.mjs'
import { CompetitionSitePreviewModal } from '../../components/admin/CompetitionSitePreviewModal'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft (hidden on site)' },
  { value: 'published', label: 'Published (live on site)' },
  { value: 'archived', label: 'Archived' },
]

function isoToDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyNewForm(catalogKind = 'main_draw') {
  const isGiveaway = catalogKind === 'giveaway'
  return {
    kind: catalogKind,
    title: '',
    slug: '',
    summary: '',
    status: 'draft',
    periodTitle: '',
    entryOpensAt: '',
    entryClosesAt: '',
    openPeriod: false,
    bundles: isGiveaway ? [] : standardBundleRows(),
    skillQuestions: legacySkillQuestionRows(),
    ...(isGiveaway ? defaultEntryMethodsForNewGiveaway() : defaultEntryMethodsForNewCompetition()),
    featuredOnHomepage: false,
  }
}

export default function AdminCompetitionCatalogPage({ catalogKind = 'main_draw' }) {
  const isGiveawayAdmin = catalogKind === 'giveaway'
  const [rows, setRows] = useState([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [newForm, setNewForm] = useState(() => emptyNewForm(catalogKind))
  const [editBundles, setEditBundles] = useState([])
  const [editSkillQuestions, setEditSkillQuestions] = useState([])
  const [periodForm, setPeriodForm] = useState({
    title: '',
    summary: '',
    entryOpensAt: '',
    entryClosesAt: '',
  })
  const [dataCounts, setDataCounts] = useState(null)
  const [purgeConfirm, setPurgeConfirm] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletePurgeData, setDeletePurgeData] = useState(true)
  const [editingPeriodId, setEditingPeriodId] = useState('')
  const [periodEdits, setPeriodEdits] = useState({ title: '', entryOpensAt: '', entryClosesAt: '' })

  const loadDetail = useCallback(async (slug) => {
    if (!slug) {
      setDraft(null)
      return
    }
    const detailRes = await apiFetch(`/api/admin/competitions?slug=${encodeURIComponent(slug)}`)
    const detail = await detailRes.json().catch(() => ({}))
    if (detailRes.ok && detail.competition) {
      setSelectedSlug(slug)
      setDraft(structuredClone(detail.competition))
    } else {
      throw new Error(detail.error || 'Could not load competition')
    }
  }, [])

  const loadList = useCallback(
    async (pickSlug) => {
      setLoading(true)
      setErr('')
      try {
        const res = await apiFetch(`/api/admin/competitions?kind=${encodeURIComponent(catalogKind)}`)
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load')
        const list = j.competitions || []
        setRows(list)
        const slug =
          pickSlug ||
          (list.some((c) => c.slug === selectedSlug) ? selectedSlug : list[0]?.slug) ||
          ''
        if (slug) await loadDetail(slug)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error')
      } finally {
        setLoading(false)
      }
    },
    [loadDetail, selectedSlug, catalogKind],
  )

  useEffect(() => {
    loadList()
  }, [])

  useEffect(() => {
    if (!draft?.bundles) {
      setEditBundles([])
      return
    }
    setEditBundles(
      draft.bundles.map((b) => ({
        bundleKey: b.bundleKey,
        title: b.title,
        qty: b.qty,
        totalPence: b.totalPence,
        line1: b.line1 || '',
        line2: b.line2 || '',
        featured: Boolean(b.featured),
        active: b.active !== false,
      })),
    )
  }, [draft?.slug, draft?.bundles])

  useEffect(() => {
    if (!draft?.skillQuestions) {
      setEditSkillQuestions([])
      return
    }
    setEditSkillQuestions(
      draft.skillQuestions.map((q, index) => ({
        questionKey: q.questionKey || q.id || `q${index + 1}`,
        prompt: q.prompt || '',
        acceptedAnswers: Array.isArray(q.acceptedAnswers) ? [...q.acceptedAnswers] : [],
      })),
    )
  }, [draft?.slug, draft?.skillQuestions])

  useEffect(() => {
    if (!draft?.slug) {
      setDataCounts(null)
      setPurgeConfirm('')
      setDeleteConfirm('')
      return
    }
    let cancelled = false
    apiFetch('/api/admin/competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'transactionCounts', competition: draft.slug }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setDataCounts(j.counts || null)
      })
      .catch(() => {
        if (!cancelled) setDataCounts(null)
      })
    return () => {
      cancelled = true
    }
  }, [draft?.slug])

  async function purgeCompetitionData() {
    if (!draft?.slug || purgeConfirm.trim() !== draft.slug) {
      setErr('Type the competition slug exactly to confirm purge.')
      return
    }
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purgeCompetitionData',
          competition: draft.slug,
          confirmSlug: purgeConfirm.trim(),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Purge failed')
      setMsg(
        `Purged ${j.purged?.tickets ?? 0} ticket row(s), ${j.purged?.entries ?? 0} quiz entries, ${j.purged?.payments ?? 0} payment(s). Competition setup kept — delete competition when ready.`,
      )
      setPurgeConfirm('')
      const countsRes = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transactionCounts', competition: draft.slug }),
      })
      const countsJson = await countsRes.json().catch(() => ({}))
      setDataCounts(countsJson.counts || null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Purge failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCompetitionPermanently() {
    if (!draft?.slug || deleteConfirm.trim() !== draft.slug) {
      setErr('Type the competition slug exactly to confirm deletion.')
      return
    }
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteCompetition',
          competition: draft.slug,
          confirmSlug: deleteConfirm.trim(),
          purgeData: deletePurgeData,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Delete failed')
      setDeleteConfirm('')
      setPurgeConfirm('')
      await loadList()
      setMsg(`Competition "${j.deletedSlug}" deleted permanently.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function selectCompetition(slug) {
    setMsg('')
    setErr('')
    try {
      await loadDetail(slug)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load competition')
    }
  }

  async function saveDetails() {
    if (!draft?.slug) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: draft.slug,
          title: draft.title,
          summary: draft.summary,
          rulesMarkdown: draft.rulesMarkdown,
          status: draft.status,
          heroImageRef: draft.heroImageRef,
          gallery: draft.gallery || [],
          allowPaidEntry: draft.allowPaidEntry,
          allowFreeOnline: draft.allowFreeOnline,
          allowPostalEntry: draft.allowPostalEntry,
          postalCompetitionName: draft.postalCompetitionName,
          featuredOnHomepage: Boolean(draft.featuredOnHomepage),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      setDraft(structuredClone(j.competition))
      setMsg('Competition saved.')
      await loadList(draft.slug)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveSkillQuestions() {
    if (!draft?.slug) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveSkillQuestions',
          competition: draft.slug,
          questions: editSkillQuestions,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      if (j.competition) setDraft(structuredClone(j.competition))
      setMsg('Skill challenge saved.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function createCompetition(e) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const payload = {
        kind: catalogKind,
        title: newForm.title.trim(),
        slug: newForm.slug.trim() || undefined,
        summary: newForm.summary.trim(),
        status: newForm.status,
        periodTitle: newForm.periodTitle.trim() || undefined,
        openPeriod: newForm.openPeriod,
        allowPaidEntry: newForm.allowPaidEntry,
        allowFreeOnline: newForm.allowFreeOnline,
        allowPostalEntry: newForm.allowPostalEntry,
        postalCompetitionName: newForm.postalCompetitionName?.trim() || undefined,
        featuredOnHomepage: newForm.featuredOnHomepage === true,
        skillQuestions: (newForm.skillQuestions || []).map((q, index) => ({
          questionKey: q.questionKey || `q${index + 1}`,
          prompt: q.prompt?.trim() || '',
          acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
        })),
      }
      if (newForm.entryOpensAt && newForm.entryClosesAt) {
        payload.entryOpensAt = new Date(newForm.entryOpensAt).toISOString()
        payload.entryClosesAt = new Date(newForm.entryClosesAt).toISOString()
      }
      const bundles = (newForm.bundles || []).filter(
        (b) => b.active !== false && b.bundleKey.trim() && b.title.trim(),
      )
      if (!bundles.length && newForm.allowPaidEntry !== false && !isGiveawayAdmin) {
        throw new Error('Add at least one active ticket bundle when paid entry is enabled.')
      }
      if (
        !isGiveawayAdmin &&
        !newForm.allowPaidEntry &&
        !newForm.allowFreeOnline &&
        !newForm.allowPostalEntry
      ) {
        throw new Error('Enable at least one entry route (paid, free online, or postal).')
      }
      if (isGiveawayAdmin && !newForm.allowFreeOnline && !newForm.allowPostalEntry) {
        throw new Error('Enable at least one free entry route (online or postal).')
      }
      if (newForm.allowPaidEntry !== false && !isGiveawayAdmin) {
        payload.bundles = bundles.map((b) => ({
        bundleKey: b.bundleKey.trim(),
        title: b.title.trim(),
        qty: b.qty,
        totalPence: b.totalPence,
        line1: b.line1?.trim() || undefined,
        line2: b.line2?.trim() || undefined,
        featured: b.featured,
        active: true,
      }))
      }
      const res = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Create failed')
      setNewOpen(false)
      setNewForm(emptyNewForm(catalogKind))
      await loadList(j.competition?.slug)
      setMsg(
        isGiveawayAdmin
          ? `Giveaway created (${j.competition?.slug}). Select it on the left, upload images, and publish when ready.`
          : `Competition created (${j.competition?.slug}) with ${bundles.length} ticket bundle(s). Select it on the left, then upload images under “Competition images” and publish when ready.`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(field) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,image/gif'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || !draft) return
      setSaving(true)
      setErr('')
      try {
        const fd = new FormData()
        fd.append('image', file)
        const res = await apiFetch('/api/admin/competition-upload', { method: 'POST', body: fd })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Upload failed')
        if (field === 'hero') {
          setDraft((d) => ({ ...d, heroImageRef: j.ref, heroImageUrl: j.url }))
        } else {
          setDraft((d) => ({
            ...d,
            gallery: [...(d.gallery || []), j.ref],
            galleryUrls: [...(d.galleryUrls || []), j.url],
          }))
        }
        setMsg('Image uploaded — save competition to persist.')
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setSaving(false)
      }
    }
    input.click()
  }

  function removeGalleryImage(index) {
    setDraft((d) => ({
      ...d,
      gallery: (d.gallery || []).filter((_, i) => i !== index),
      galleryUrls: (d.galleryUrls || []).filter((_, i) => i !== index),
    }))
    setMsg('Gallery updated — save competition to persist.')
  }

  async function saveAllBundles() {
    if (!draft?.slug) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const rows = editBundles.filter((b) => b.bundleKey.trim() && b.title.trim())
      if (!rows.some((b) => b.active !== false)) {
        throw new Error('At least one active ticket bundle is required.')
      }
      const previousKeys = new Set((draft.bundles || []).map((b) => b.bundleKey))
      const nextKeys = new Set(rows.map((b) => b.bundleKey.trim()))

      for (const bundle of rows) {
        const res = await apiFetch('/api/admin/competitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsertBundle',
            competition: draft.slug,
            bundle: {
              bundleKey: bundle.bundleKey.trim(),
              title: bundle.title.trim(),
              qty: bundle.qty,
              totalPence: bundle.totalPence,
              line1: bundle.line1?.trim() || undefined,
              line2: bundle.line2?.trim() || undefined,
              featured: bundle.featured,
              active: bundle.active !== false,
            },
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || `Could not save bundle "${bundle.bundleKey}"`)
      }

      for (const key of previousKeys) {
        if (!nextKeys.has(key)) {
          await deleteBundle(key, { skipConfirm: true })
        }
      }

      await selectCompetition(draft.slug)
      setMsg('Ticket bundles saved.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bundle save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBundle(bundleKey, { skipConfirm = false } = {}) {
    if (!draft?.slug) return
    if (!skipConfirm && !window.confirm(`Delete bundle "${bundleKey}"?`)) return
    const res = await apiFetch('/api/admin/competitions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competition: draft.slug, bundleKey }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Delete failed')
      return
    }
    await selectCompetition(draft.slug)
  }

  async function createPeriod(e) {
    e.preventDefault()
    if (!draft?.slug) return
    setSaving(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createPeriod',
          competition: draft.slug,
          title: periodForm.title,
          summary: periodForm.summary,
          entryOpensAt: new Date(periodForm.entryOpensAt).toISOString(),
          entryClosesAt: new Date(periodForm.entryClosesAt).toISOString(),
          status: PERIOD_STATUS.draft,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not create period')
      setPeriodForm({ title: '', summary: '', entryOpensAt: '', entryClosesAt: '' })
      await selectCompetition(draft.slug)
      setMsg('Competition period created.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Period create failed')
    } finally {
      setSaving(false)
    }
  }

  async function setPeriodStatus(periodId, status) {
    setSaving(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: draft.slug, action: 'periodStatus', periodId, status }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Period update failed')
      await selectCompetition(draft.slug)
      setMsg('Period status updated.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Period update failed')
    } finally {
      setSaving(false)
    }
  }

  function startEditPeriod(period) {
    setEditingPeriodId(period.id)
    setPeriodEdits({
      title: period.title || '',
      entryOpensAt: isoToDatetimeLocal(period.entryOpensAt),
      entryClosesAt: isoToDatetimeLocal(period.entryClosesAt),
    })
  }

  async function savePeriodDates(periodId) {
    if (!draft?.slug || !periodId) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePeriod',
          periodId,
          title: periodEdits.title.trim(),
          entryOpensAt: new Date(periodEdits.entryOpensAt).toISOString(),
          entryClosesAt: new Date(periodEdits.entryClosesAt).toISOString(),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not save period dates')
      if (j.competition) setDraft(structuredClone(j.competition))
      setEditingPeriodId('')
      setMsg('Entry period dates saved. Open the period if entries should be live now.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save period dates')
    } finally {
      setSaving(false)
    }
  }

  const isGiveawayDraft = isGiveawayAdmin || draft?.kind === 'giveaway'

  const openPeriod = useMemo(
    () => draft?.periods?.find((p) => p.status === PERIOD_STATUS.open),
    [draft],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-100">
            {isGiveawayAdmin ? 'Giveaways' : 'Competitions'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            {isGiveawayAdmin
              ? 'Create and manage free-only prize draws — photos, skill challenge, postal and online entry. No paid ticket bundles.'
              : 'Create and manage main prize draws — photos, rules, ticket bundles, and entry timeline. No code changes needed.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewOpen((v) => !v)
            if (newOpen) setNewForm(emptyNewForm(catalogKind))
          }}
          className="rounded-lg border border-teal-500/35 bg-teal-950/40 px-4 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-950/60"
        >
          {newOpen ? 'Cancel' : isGiveawayAdmin ? 'Create new giveaway' : 'Create new competition'}
        </button>
      </div>

      {newOpen ? (
        <form onSubmit={createCompetition} className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
          <h2 className="text-sm font-semibold text-stone-300">
            {isGiveawayAdmin ? 'New giveaway' : 'New competition'}
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            {isGiveawayAdmin
              ? 'Free entry only — appears on the public Competitions page when published.'
              : 'Creates an isolated main draw with its own periods, ticket bundles, entries, and draw pool.'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-stone-400 sm:col-span-2">
              Title
              <input
                required
                value={newForm.title}
                onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
              />
            </label>
            <label className="block text-sm text-stone-400">
              Slug (optional)
              <input
                value={newForm.slug}
                onChange={(e) => setNewForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="auto-from-title"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
              />
            </label>
            <label className="block text-sm text-stone-400">
              Status
              <select
                value={newForm.status}
                onChange={(e) => setNewForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-stone-400 sm:col-span-2">
              Summary
              <textarea
                rows={2}
                value={newForm.summary}
                onChange={(e) => setNewForm((f) => ({ ...f, summary: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
              />
            </label>
            <label className="block text-sm text-stone-400 sm:col-span-2">
              First entry period title (optional)
              <input
                value={newForm.periodTitle}
                onChange={(e) => setNewForm((f) => ({ ...f, periodTitle: e.target.value }))}
                placeholder="e.g. Spring 2026 draw"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
              />
            </label>
            <label className="block text-sm text-stone-400">
              Entries open
              <input
                type="datetime-local"
                value={newForm.entryOpensAt}
                onChange={(e) => setNewForm((f) => ({ ...f, entryOpensAt: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
              />
            </label>
            <label className="block text-sm text-stone-400">
              Entries close
              <input
                type="datetime-local"
                value={newForm.entryClosesAt}
                onChange={(e) => setNewForm((f) => ({ ...f, entryClosesAt: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-400 sm:col-span-2">
              <input
                type="checkbox"
                checked={newForm.openPeriod}
                onChange={(e) => setNewForm((f) => ({ ...f, openPeriod: e.target.checked }))}
                className="rounded border-white/20"
              />
              Open this period immediately (accepts entries when competition is published)
            </label>
          </div>

          {!isGiveawayAdmin ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <label className="flex items-start gap-2 text-sm text-stone-400">
                <input
                  type="checkbox"
                  checked={Boolean(newForm.featuredOnHomepage)}
                  onChange={(e) => setNewForm((f) => ({ ...f, featuredOnHomepage: e.target.checked }))}
                  className="mt-1"
                />
                <span>Feature on homepage live promotion panel (only one at a time; Legacy is featured by default)</span>
              </label>
            </div>
          ) : null}

          <div className="mt-4 border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold text-stone-300">Entry routes</h3>
            <div className="mt-3">
              <CompetitionEntryMethodsEditor
                giveawayMode={isGiveawayAdmin}
                allowPaidEntry={newForm.allowPaidEntry}
                allowFreeOnline={newForm.allowFreeOnline}
                allowPostalEntry={newForm.allowPostalEntry}
                postalCompetitionName={newForm.postalCompetitionName}
                competitionTitle={newForm.title}
                onChange={(patch) => setNewForm((f) => ({ ...f, ...patch }))}
              />
            </div>
          </div>

          {newForm.allowPaidEntry !== false && !isGiveawayAdmin ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <h3 className="text-sm font-semibold text-stone-300">Ticket bundles &amp; prices</h3>
              <div className="mt-3">
                <CompetitionBundleEditor
                  compact
                  bundles={newForm.bundles}
                  onChange={(bundles) => setNewForm((f) => ({ ...f, bundles }))}
                  competitionTitle={newForm.title}
                />
              </div>
            </div>
          ) : null}

          {(newForm.allowPaidEntry !== false || newForm.allowFreeOnline) ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <h3 className="text-sm font-semibold text-stone-300">Skill challenge</h3>
              <div className="mt-3">
                <CompetitionSkillChallengeEditor
                  compact
                  questions={newForm.skillQuestions || []}
                  onChange={(skillQuestions) => setNewForm((f) => ({ ...f, skillQuestions }))}
                />
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Creating…' : isGiveawayAdmin ? 'Create giveaway' : 'Create competition'}
          </button>
        </form>
      ) : null}

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      {loading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {!loading ? (
        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <aside className="space-y-1 rounded-xl border border-white/10 bg-stone-900/30 p-2">
            {rows.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => selectCompetition(c.slug)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  selectedSlug === c.slug
                    ? 'bg-teal-900/50 font-semibold text-teal-100'
                    : 'text-stone-400 hover:bg-white/5 hover:text-stone-200'
                }`}
              >
                {c.title}
                <span className="mt-0.5 block text-[10px] uppercase tracking-wide opacity-70">{c.status}</span>
              </button>
            ))}
          </aside>

          {draft ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-stone-500">
                  Slug: <span className="font-mono text-stone-400">{draft.slug}</span>
                  {draft.status === 'published'
                    ? ' · Visible on /competitions when published'
                    : ' · Set Published to appear on the competitions page'}
                  {' · '}
                  <span className="text-teal-400/90">Images: scroll to “Competition images” below</span>
                </p>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="rounded-lg border border-teal-500/35 bg-teal-950/30 px-3 py-1.5 text-sm font-semibold text-teal-100 hover:bg-teal-950/50"
                >
                  Preview on site
                </button>
              </div>
              <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Details &amp; rules</h2>
                <div className="mt-3 grid gap-3">
                  <label className="block text-sm text-stone-400">
                    Title
                    <input
                      value={draft.title || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
                    />
                  </label>
                  <label className="block text-sm text-stone-400">
                    Summary (short pitch)
                    <textarea
                      rows={2}
                      value={draft.summary || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
                    />
                  </label>
                  <label className="block text-sm text-stone-400">
                    Rules (markdown)
                    <textarea
                      rows={8}
                      value={draft.rulesMarkdown || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, rulesMarkdown: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-stone-100"
                    />
                  </label>
                  <label className="block text-sm text-stone-400">
                    Status
                    <select
                      value={draft.status || 'draft'}
                      onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!isGiveawayDraft ? (
                  <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-stone-300">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.featuredOnHomepage)}
                      onChange={(e) => setDraft((d) => ({ ...d, featuredOnHomepage: e.target.checked }))}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-stone-100">Feature on homepage (live promotion panel)</span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        Replaces the main ShowSkills homepage hero with this competition (like Ronaldo Legacy Bundle
                        today). Only one competition can be featured at a time.
                      </span>
                    </span>
                  </label>
                  ) : null}
                  <div className="rounded-lg border border-teal-500/20 bg-teal-950/20 p-4">
                    <h3 className="text-sm font-semibold text-teal-100">Competition images</h3>
                    <p className="mt-1 text-xs text-stone-400">
                      Upload a hero poster and optional gallery tiles. They appear on the competitions page (and
                      homepage if featured). Click a button below to pick a file from your computer, then{' '}
                      <strong className="font-medium text-stone-300">Save competition</strong>.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => uploadImage('hero')}
                        className="rounded-lg border border-teal-500/40 bg-teal-900/40 px-4 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-900/60"
                      >
                        Upload hero image
                      </button>
                      <button
                        type="button"
                        onClick={() => uploadImage('gallery')}
                        className="rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
                      >
                        Add gallery image
                      </button>
                    </div>
                  </div>
                  {draft.heroImageUrl ? (
                    <div>
                      <p className="text-xs text-stone-500">Hero (main poster on competitions page)</p>
                      <img src={draft.heroImageUrl} alt="" className="mt-1 max-h-48 rounded-lg border border-white/10" />
                    </div>
                  ) : null}
                  {(draft.galleryUrls || []).length ? (
                    <div>
                      <p className="text-xs text-stone-500">Gallery (smaller tiles under hero)</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(draft.galleryUrls || []).map((url, index) => (
                          <div key={`${url}-${index}`} className="relative">
                            <img src={url} alt="" className="h-24 w-24 rounded-lg border border-white/10 object-cover" />
                            <button
                              type="button"
                              onClick={() => removeGalleryImage(index)}
                              className="absolute -right-1 -top-1 rounded-full bg-red-900 px-1.5 py-0.5 text-[10px] text-red-100"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveDetails}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save competition
                  </button>
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Entry routes</h2>
                <div className="mt-3">
                  <CompetitionEntryMethodsEditor
                    giveawayMode={isGiveawayDraft}
                    allowPaidEntry={draft.allowPaidEntry}
                    allowFreeOnline={draft.allowFreeOnline}
                    allowPostalEntry={draft.allowPostalEntry}
                    postalCompetitionName={draft.postalCompetitionName}
                    competitionTitle={draft.title}
                    onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                  />
                </div>
                <p className="mt-2 text-xs text-stone-500">Save competition above to persist entry route changes.</p>
              </section>

              {draft.allowPaidEntry !== false || draft.allowFreeOnline ? (
                <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Skill challenge</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Required for paid and free online entry. Entrants see the question prompts only; acceptable answers
                    stay private on the server.
                  </p>
                  <div className="mt-3">
                    <CompetitionSkillChallengeEditor
                      questions={editSkillQuestions}
                      onChange={setEditSkillQuestions}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveSkillQuestions}
                    className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save skill challenge
                  </button>
                </section>
              ) : null}

              {draft.allowPaidEntry !== false && !isGiveawayDraft ? (
              <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Ticket bundles &amp; prices</h2>
                <div className="mt-3">
                  <CompetitionBundleEditor
                    bundles={editBundles}
                    onChange={setEditBundles}
                    competitionTitle={draft.title}
                  />
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveAllBundles}
                  className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save ticket bundles
                </button>
              </section>
              ) : null}

              <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Entry timeline</h2>
                <p className="mt-1 text-xs text-stone-500">
                  Set the entry month and close date here — no code changes. Use <strong className="text-stone-400">Edit dates</strong>{' '}
                  on a period, then <strong className="text-stone-400">Open</strong> so the site accepts entries. Only{' '}
                  <strong className="text-stone-400">Published</strong> competitions appear on /competitions.
                </p>
                {openPeriod ? (
                  <p className="mt-2 text-sm text-emerald-300">
                    Open period: {openPeriod.title}
                    {formatPeriodMonthLabel(openPeriod.entryClosesAt)
                      ? ` · closes ${formatPeriodMonthLabel(openPeriod.entryClosesAt)}`
                      : ''}{' '}
                    ·{' '}
                    {new Date(openPeriod.entryClosesAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-200/90">
                    No open period — entries are blocked on the live site until you open one (after setting dates).
                  </p>
                )}
                <ul className="mt-3 space-y-2">
                  {(draft.periods || []).map((p) => (
                    <li
                      key={p.id}
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-stone-200">{p.title}</div>
                          <div className="text-xs text-stone-500">
                            {PERIOD_STATUS_LABELS[p.status] || p.status}
                            {formatPeriodMonthLabel(p.entryClosesAt)
                              ? ` · ${formatPeriodMonthLabel(p.entryClosesAt)}`
                              : ''}{' '}
                            ·{' '}
                            {new Date(p.entryOpensAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })} →{' '}
                            {new Date(p.entryClosesAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <MiniBtn onClick={() => startEditPeriod(p)}>Edit dates</MiniBtn>
                          {p.status !== PERIOD_STATUS.open ? (
                            <MiniBtn onClick={() => setPeriodStatus(p.id, PERIOD_STATUS.open)}>Open</MiniBtn>
                          ) : null}
                          {p.status === PERIOD_STATUS.open ? (
                            <MiniBtn onClick={() => setPeriodStatus(p.id, PERIOD_STATUS.closed)}>Close</MiniBtn>
                          ) : null}
                        </div>
                      </div>
                      {editingPeriodId === p.id ? (
                        <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
                          <label className="block text-xs text-stone-400 sm:col-span-2">
                            Period title (include month, e.g. June 2026 draw)
                            <input
                              value={periodEdits.title}
                              onChange={(e) => setPeriodEdits((f) => ({ ...f, title: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
                            />
                          </label>
                          <label className="block text-xs text-stone-400">
                            Entries open
                            <input
                              required
                              type="datetime-local"
                              value={periodEdits.entryOpensAt}
                              onChange={(e) => setPeriodEdits((f) => ({ ...f, entryOpensAt: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
                            />
                          </label>
                          <label className="block text-xs text-stone-400">
                            Entries close
                            <input
                              required
                              type="datetime-local"
                              value={periodEdits.entryClosesAt}
                              onChange={(e) => setPeriodEdits((f) => ({ ...f, entryClosesAt: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
                            />
                          </label>
                          <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => savePeriodDates(p.id)}
                              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Save period dates
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPeriodId('')}
                              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-stone-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <form onSubmit={createPeriod} className="mt-4 grid gap-2 sm:grid-cols-2">
                  <input
                    required
                    placeholder="Period title"
                    value={periodForm.title}
                    onChange={(e) => setPeriodForm((f) => ({ ...f, title: e.target.value }))}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100 sm:col-span-2"
                  />
                  <input
                    required
                    type="datetime-local"
                    value={periodForm.entryOpensAt}
                    onChange={(e) => setPeriodForm((f) => ({ ...f, entryOpensAt: e.target.value }))}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
                  />
                  <input
                    required
                    type="datetime-local"
                    value={periodForm.entryClosesAt}
                    onChange={(e) => setPeriodForm((f) => ({ ...f, entryClosesAt: e.target.value }))}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm text-stone-300 sm:col-span-2"
                  >
                    Create new period
                  </button>
                </form>
              </section>

              <section className="rounded-xl border border-red-500/25 bg-red-950/20 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-red-200">Data retention &amp; delete</h2>
                <p className="mt-2 text-xs text-stone-400">
                  After a draw closes (and once your tax records allow), purge ticket sales and quiz entries. Then delete
                  the competition so it no longer appears on the site or in admin.
                </p>
                {dataCounts ? (
                  <p className="mt-2 text-xs text-stone-500">
                    Stored for this competition:{' '}
                    <span className="font-mono text-stone-300">{dataCounts.tickets}</span> ticket purchase(s),{' '}
                    <span className="font-mono text-stone-300">{dataCounts.entries}</span> quiz entries,{' '}
                    <span className="font-mono text-stone-300">{dataCounts.payments}</span> payment(s),{' '}
                    <span className="font-mono text-stone-300">{dataCounts.drawRuns}</span> draw record(s).
                  </p>
                ) : null}

                <div className="mt-4 space-y-4 border-t border-red-500/15 pt-4">
                  <div>
                    <h3 className="text-xs font-semibold text-stone-300">Purge tickets, entries &amp; sales</h3>
                    <p className="mt-1 text-[11px] text-stone-500">
                      Removes purchases, payments, quiz entries, and draw audit rows. Keeps the competition definition
                      (rules, bundles, periods) until you delete it.
                    </p>
                    <input
                      value={purgeConfirm}
                      onChange={(e) => setPurgeConfirm(e.target.value)}
                      placeholder={`Type ${draft.slug} to confirm purge`}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-stone-100"
                    />
                    <button
                      type="button"
                      disabled={saving || purgeConfirm.trim() !== draft.slug}
                      onClick={purgeCompetitionData}
                      className="mt-2 rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
                    >
                      Purge entry &amp; sales data
                    </button>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-red-200">Delete competition permanently</h3>
                    <p className="mt-1 text-[11px] text-stone-500">
                      Removes this competition from admin and the public site (images, bundles, periods). Cannot be undone.
                    </p>
                    <label className="mt-2 flex items-start gap-2 text-[11px] text-stone-400">
                      <input
                        type="checkbox"
                        checked={deletePurgeData}
                        onChange={(e) => setDeletePurgeData(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>Also delete all tickets, entries, payments, and draw records (required if any remain)</span>
                    </label>
                    <input
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder={`Type ${draft.slug} to confirm delete`}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-stone-100"
                    />
                    <button
                      type="button"
                      disabled={saving || deleteConfirm.trim() !== draft.slug}
                      onClick={deleteCompetitionPermanently}
                      className="mt-2 rounded-lg border border-red-500/40 bg-red-900/50 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-900/70 disabled:opacity-50"
                    >
                      Delete competition forever
                    </button>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <p className="text-sm text-stone-500">
              Select a {isGiveawayAdmin ? 'giveaway' : 'competition'} to edit.
            </p>
          )}
        </div>
      ) : null}

      <CompetitionSitePreviewModal draft={draft} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  )
}

function MiniBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-white/10 px-2 py-0.5 text-xs text-stone-400 hover:bg-white/5"
    >
      {children}
    </button>
  )
}
