import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink, Eye, EyeOff, LayoutTemplate, Monitor, Redo2, RotateCcw, SlidersHorizontal, Smartphone, Undo2 } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { notifyLayoutUpdated } from '../../lib/publicDataCache.js'
import { DEFAULT_SOCIAL_HANDLE } from '../../../shared/socialLinks.mjs'
import { PageEditorPreviewProvider } from '../../pageEditor/PageEditorPreviewContext.jsx'
import { MobileLayoutSettingsPanel } from '../../components/admin/MobileLayoutSettingsPanel'
import { EDITOR_VIEWPORT_DESKTOP, EDITOR_VIEWPORT_MOBILE } from '../../../shared/layoutOffsets.mjs'
import { useEditorHistoryShortcuts, usePageEditorHistory } from '../../pageEditor/usePageEditorHistory.js'
import { PageLivePreview } from '../../components/admin/PageLivePreview'
import { PageEditorSettingsDrawer } from '../../components/admin/EditableSectionOverlay'
import {
  HOMEPAGE_BLOCK_IDS,
  HOMEPAGE_HERO_BACKGROUNDS,
  defaultHomepageLayout,
  homeBlockEditorVisible,
  mergeHomepageLayout,
} from '../../../shared/homepageLayout.mjs'
import {
  PAGE_EDITOR_LABELS,
  SITE_SHELL_ID,
  COMPETITIONS_PAGE_ID,
  FAQ_PAGE_ID,
  CONTACT_PAGE_ID,
  SHIRT_GIVEAWAY_PAGE_ID,
  EMAIL_LAYOUT_PAGE_ID,
  HOMEPAGE_BLOCK_LABELS,
  COMPETITIONS_BLOCK_LABELS,
  SITE_PAGE_BACKGROUNDS,
  defaultSiteShell,
  mergeSiteShell,
  defaultCompetitionsPageLayout,
  mergeCompetitionsPageLayout,
  defaultLegacyBundleCardLayout,
  defaultShirtGiveawayCardLayout,
  defaultFaqPageLayout,
  mergeFaqPageLayout,
  defaultContactPageLayout,
  mergeContactPageLayout,
  defaultShirtGiveawayPageLayout,
  mergeShirtGiveawayPageLayout,
} from '../../../shared/sitePageLayout.mjs'
import { DraggableSectionList, EditorField, editorInputClass } from '../../components/admin/DraggableSectionList'
import { EmailEditorSettings } from '../../components/admin/EmailEditorSettings'
import { NewsletterEmailPreview } from '../../components/admin/NewsletterEmailPreview'
import { defaultEmailLayout, mergeEmailLayout } from '../../../shared/emailLayout.mjs'
import { KICKUPS_GIVEAWAY_IMAGE } from '../../competitionVisuals'

const PAGE_TABS = [
  { id: SITE_SHELL_ID, path: null, preview: '/' },
  { id: 'homepage', path: null, preview: '/' },
  { id: COMPETITIONS_PAGE_ID, path: '/competitions', preview: '/competitions' },
  { id: FAQ_PAGE_ID, path: '/faq', preview: '/faq' },
  { id: CONTACT_PAGE_ID, path: '/contact', preview: '/contact' },
  { id: SHIRT_GIVEAWAY_PAGE_ID, path: '/archive/ronaldo-shirt-giveaway', preview: '/archive/ronaldo-shirt-giveaway' },
  { id: EMAIL_LAYOUT_PAGE_ID, path: null, preview: null },
]

function HomeBlockVisibilityToggle({ blockId, block, onChange }) {
  const checked = homeBlockEditorVisible(block, blockId)
  return (
    <label className="flex items-center gap-2 text-xs text-stone-500">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Show on homepage
    </label>
  )
}

function mergeAllPages(raw) {
  return {
    site: mergeSiteShell(raw?.site),
    homepage: mergeHomepageLayout(raw?.homepage),
    competitions: mergeCompetitionsPageLayout(raw?.competitions),
    faq: mergeFaqPageLayout(raw?.faq),
    contact: mergeContactPageLayout(raw?.contact),
    shirt_giveaway: mergeShirtGiveawayPageLayout(raw?.shirt_giveaway),
    emails: mergeEmailLayout(raw?.emails),
  }
}

function defaultAllPages() {
  return {
    site: defaultSiteShell(),
    homepage: defaultHomepageLayout(),
    competitions: defaultCompetitionsPageLayout(),
    faq: defaultFaqPageLayout(),
    contact: defaultContactPageLayout(),
    shirt_giveaway: defaultShirtGiveawayPageLayout(),
    emails: defaultEmailLayout(),
  }
}

export default function PageEditorPage() {
  const [searchParams] = useSearchParams()
  const [activePage, setActivePage] = useState('homepage')
  const {
    pages,
    setPages,
    replacePages,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePageEditorHistory(defaultAllPages())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [selectedBlockId, setSelectedBlockId] = useState('hero_intro')
  const [shellHighlight, setShellHighlight] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState('page')
  const [cleanPreview, setCleanPreview] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [editorViewport, setEditorViewport] = useState(EDITOR_VIEWPORT_DESKTOP)
  const [emailPreviewKind, setEmailPreviewKind] = useState('welcome')
  const skipLayoutReloadRef = useRef(false)

  useEditorHistoryShortcuts({ undo, redo, enabled: !loading && !cleanPreview })

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/site-pages')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Session expired or not signed in — open /admin/login first, then return to the editor.')
        }
        throw new Error(j.detail || j.error || 'Failed to load')
      }
      replacePages(mergeAllPages(j.pages))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [replacePages])

  useEffect(() => {
    load()
  }, [load])

  /** Keep editor draft aligned with saved layout on the live site (other tabs / after save). */
  useEffect(() => {
    function reloadFromServer() {
      if (skipLayoutReloadRef.current) {
        skipLayoutReloadRef.current = false
        return
      }
      load()
    }
    function onVisible() {
      if (document.visibilityState === 'visible') reloadFromServer()
    }
    window.addEventListener('ss-layout-updated', reloadFromServer)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('ss-layout-updated', reloadFromServer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  useEffect(() => {
    const tab = searchParams.get('page') || searchParams.get('tab')
    if (!tab || !PAGE_TABS.some((t) => t.id === tab)) return
    setActivePage(tab)
    if (tab === SHIRT_GIVEAWAY_PAGE_ID) {
      setSettingsTarget('page')
      setSettingsOpen(true)
    }
    if (tab === EMAIL_LAYOUT_PAGE_ID) {
      setSettingsTarget('page')
      setSettingsOpen(true)
      setEmailPreviewKind('welcome')
    }
  }, [searchParams])

  function openSettings(target = 'page') {
    setSettingsTarget(target)
    setSettingsOpen(true)
  }

  async function saveCurrentPage() {
    const savePageId =
      settingsOpen && settingsTarget === 'shell' ? SITE_SHELL_ID : activePage
    const layoutToSave = pages[savePageId]
    if (!layoutToSave) return

    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/site-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: savePageId, layout: layoutToSave }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.detail || j.error || 'Save failed')
      const merged = mergeAllPages({ ...pages, [savePageId]: j.layout })
      replacePages(merged)
      skipLayoutReloadRef.current = true
      notifyLayoutUpdated(savePageId)
      setMsg(
        `${PAGE_EDITOR_LABELS[savePageId] || savePageId} saved to the database. Open the live site (or refresh) to see it — preview in the editor is draft until you save.`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function resetCurrentPage() {
    const defaults = defaultAllPages()
    const resetId = settingsTarget === 'shell' ? SITE_SHELL_ID : activePage
    setPages((p) => ({ ...p, [resetId]: defaults[resetId] }))
    setMsg('Reset to defaults (not saved yet — click Save to apply).')
  }

  useEffect(() => {
    if (activePage !== 'homepage' || !selectedBlockId) return
    const el = document.getElementById(`editor-block-${selectedBlockId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activePage, selectedBlockId])

  useEffect(() => {
    if (activePage !== COMPETITIONS_PAGE_ID || !selectedBlockId) return
    document.querySelector(`[data-editor-drag="${selectedBlockId}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [activePage, selectedBlockId])

  useEffect(() => {
    if (activePage === SITE_SHELL_ID && shellHighlight === 'header') {
      document.getElementById('editor-site-header')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (activePage === SITE_SHELL_ID && shellHighlight === 'footer') {
      document.getElementById('editor-site-footer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activePage, shellHighlight])

  const activeTab = PAGE_TABS.find((t) => t.id === activePage) ?? PAGE_TABS[1]

  function patchPage(pageId, patch) {
    setPages((p) => ({ ...p, [pageId]: { ...p[pageId], ...patch } }))
  }

  function patchHomeBlock(blockId, patch) {
    setPages((p) => ({
      ...p,
      homepage: {
        ...p.homepage,
        blocks: {
          ...p.homepage.blocks,
          [blockId]: { ...p.homepage.blocks[blockId], ...patch },
        },
      },
    }))
  }

  const homepageSections = useMemo(
    () =>
      (pages.homepage.blockOrder || HOMEPAGE_BLOCK_IDS)
        .filter((id) => HOMEPAGE_BLOCK_IDS.includes(id))
        .map((id) => ({ id, label: HOMEPAGE_BLOCK_LABELS[id] || id })),
    [pages.homepage.blockOrder],
  )

  const shell = pages.site
  const homepage = pages.homepage
  const intro = homepage.blocks.hero_intro
  const prizes = homepage.blocks.hero_prizes
  const promo = homepage.blocks.promo_strip
  const details = homepage.blocks.hero_details
  const winners = homepage.blocks.winners_panel
  const comp = pages.competitions

  const PRIZE_IMAGE_LABELS = {
    prize_poster: 'Bundle poster position',
    prize_phone: 'Phone prize position',
    prize_case: 'Gold case position',
  }

  const settingsTitle =
    settingsTarget === 'shell'
      ? shellHighlight === 'footer'
        ? 'Site footer'
        : 'Site header'
      : PRIZE_IMAGE_LABELS[selectedBlockId]
        ? PRIZE_IMAGE_LABELS[selectedBlockId]
        : activePage === COMPETITIONS_PAGE_ID && COMPETITIONS_BLOCK_LABELS[selectedBlockId]
          ? COMPETITIONS_BLOCK_LABELS[selectedBlockId]
          : activePage === 'homepage' && selectedBlockId
          ? HOMEPAGE_BLOCK_LABELS[selectedBlockId] || selectedBlockId
          : PAGE_EDITOR_LABELS[activePage] || activePage

  const savePageIdForLabel =
    settingsOpen && settingsTarget === 'shell' ? SITE_SHELL_ID : activePage
  const saveLabel = `Save ${PAGE_EDITOR_LABELS[savePageIdForLabel] || savePageIdForLabel}`

  return (
    <div className="ss-page-editor-workspace flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-teal-400/90">
              <LayoutTemplate className="h-5 w-5" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wider">Site editor</span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-stone-100">Design your site</h1>
            <p className="mt-1 max-w-2xl text-xs text-stone-500">
              Same components as the live site — what you see is what saves. Drag moves (8px grid, hold Shift for fine
              control) · Ctrl/Cmd+drag resizes · Toolbar aligns to panel or neighbours · Save per tab · Undo ⌘Z
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeTab.preview ? (
              <Link
                to={activeTab.preview}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-stone-300 hover:bg-white/5"
              >
                Live site
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              title="Undo (⌘Z / Ctrl+Z)"
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-sm text-stone-300 hover:bg-white/5 disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={redo}
              title="Redo (⌘⇧Z / Ctrl+Y)"
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-sm text-stone-300 hover:bg-white/5 disabled:opacity-40"
            >
              <Redo2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Redo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCleanPreview((v) => !v)
                if (!cleanPreview) setSettingsOpen(false)
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
                cleanPreview
                  ? 'border-teal-500/50 bg-teal-950/40 text-teal-100'
                  : 'border-white/15 text-stone-300 hover:bg-white/5'
              }`}
              title="Hide editor labels and handles — see the page as visitors will"
            >
              {cleanPreview ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              {cleanPreview ? 'Edit' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={() => setShowGrid((v) => !v)}
              disabled={cleanPreview}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 ${
                showGrid && !cleanPreview
                  ? 'border-teal-500/40 bg-teal-950/30 text-teal-100'
                  : 'border-white/15 text-stone-300 hover:bg-white/5'
              }`}
              title="Toggle 8px alignment grid"
            >
              Grid
            </button>
            <div className="inline-flex rounded-lg border border-white/15 p-0.5">
              <button
                type="button"
                disabled={cleanPreview}
                onClick={() => setEditorViewport(EDITOR_VIEWPORT_DESKTOP)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm disabled:opacity-40 ${
                  editorViewport === EDITOR_VIEWPORT_DESKTOP
                    ? 'bg-teal-600/25 text-teal-100'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Edit desktop layout (768px and up)"
              >
                <Monitor className="h-3.5 w-3.5" aria-hidden />
                Desktop
              </button>
              <button
                type="button"
                disabled={cleanPreview}
                onClick={() => setEditorViewport(EDITOR_VIEWPORT_MOBILE)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm disabled:opacity-40 ${
                  editorViewport === EDITOR_VIEWPORT_MOBILE
                    ? 'bg-amber-600/25 text-amber-100'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Edit mobile layout (under 768px)"
              >
                <Smartphone className="h-3.5 w-3.5" aria-hidden />
                Mobile
              </button>
            </div>
            <button
              type="button"
              onClick={() => openSettings(settingsTarget)}
              disabled={cleanPreview}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-stone-300 hover:bg-white/5 disabled:opacity-40"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Settings
            </button>
            <button
              type="button"
              onClick={resetCurrentPage}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-stone-400 hover:bg-white/5 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={saveCurrentPage}
              className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>

        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

        <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-2">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActivePage(tab.id)
                setSettingsTarget('page')
                setShellHighlight(null)
                if (tab.id === 'homepage') setSelectedBlockId('hero_intro')
                if (tab.id === COMPETITIONS_PAGE_ID) {
                  setSelectedBlockId('comp_title')
                  openSettings('page')
                }
                if (tab.id === SHIRT_GIVEAWAY_PAGE_ID) openSettings('page')
                if (tab.id === EMAIL_LAYOUT_PAGE_ID) {
                  openSettings('page')
                  setEmailPreviewKind('welcome')
                }
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activePage === tab.id
                  ? 'bg-teal-600/20 text-teal-100 ring-1 ring-teal-500/40'
                  : 'text-stone-400 hover:bg-white/5 hover:text-stone-200'
              }`}
            >
              {PAGE_EDITOR_LABELS[tab.id] || tab.id}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-sm text-stone-500 sm:px-6">Loading page settings…</p>
      ) : (
        <PageEditorPreviewProvider pages={pages} editorViewport={editorViewport}>
          <div className="relative min-h-0 flex-1">
            <PageLivePreview
              activePage={activePage}
              pages={pages}
              cleanPreview={cleanPreview}
              showGrid={showGrid}
              selectedBlockId={selectedBlockId}
              onSelectBlock={(id) => {
                if (cleanPreview) return
                setSelectedBlockId(id)
                setSettingsTarget('page')
                setShellHighlight(null)
              }}
              onPatchHomepage={(patch) => patchPage('homepage', patch)}
              onPatchHomeBlock={patchHomeBlock}
              onPatchCompetitions={(patch) => patchPage(COMPETITIONS_PAGE_ID, patch)}
              onPatchSite={(patch) => patchPage(SITE_SHELL_ID, patch)}
              shellHighlight={shellHighlight}
              onShellHighlight={setShellHighlight}
              onOpenSettings={openSettings}
              emailPreviewKind={emailPreviewKind}
            />
          </div>

          <PageEditorSettingsDrawer
            open={settingsOpen}
            title={settingsTitle}
            onClose={() => setSettingsOpen(false)}
          >
            <div className="space-y-6">
      {!loading && (settingsTarget === 'shell' || activePage === SITE_SHELL_ID) ? (
        <SiteShellEditor shell={shell} onChange={(patch) => patchPage(SITE_SHELL_ID, patch)} setPages={setPages} />
      ) : null}

      {!loading && settingsTarget === 'page' && activePage === 'homepage' ? (
        <div className="space-y-6">
          <MobileLayoutSettingsPanel
            editorViewport={editorViewport}
            onResetPageMobile={() => {
              const heroBlockIds = ['promo_strip', 'hero_intro', 'hero_prizes', 'hero_details', 'ticket_bundles']
              const blocks = { ...homepage.blocks }
              for (const id of heroBlockIds) {
                if (blocks[id]) blocks[id] = { ...blocks[id], mobileOffsets: {} }
              }
              patchPage('homepage', { blocks })
            }}
          />
          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Section order</h2>
            <p className="mt-1 text-xs text-stone-500">
              Reorder major sections (Hero, Competitions hub, Winners) in the list below. Hero blocks keep the original
              grid layout on the live site.
            </p>
            <div className="mt-3">
              <DraggableSectionList
                items={homepageSections}
                onReorder={(ids) => patchPage('homepage', { blockOrder: ids })}
                renderExtra={(item) => {
                  const block = homepage.blocks[item.id]
                  return (
                    <HomeBlockVisibilityToggle
                      blockId={item.id}
                      block={block}
                      onChange={(visible) => patchHomeBlock(item.id, { visible })}
                    />
                  )
                }}
              />
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Hero background & layout</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <EditorField label="Hero background photo">
                <select
                  value={homepage.heroBackground}
                  onChange={(e) => patchPage('homepage', { heroBackground: e.target.value })}
                  className={editorInputClass()}
                >
                  <option value={HOMEPAGE_HERO_BACKGROUNDS.kickups}>Pitch photo (default)</option>
                  <option value={HOMEPAGE_HERO_BACKGROUNDS.competitions}>Competitions photo</option>
                </select>
              </EditorField>
              <EditorField label="Desktop column order">
                <select
                  value={homepage.heroColumnOrder}
                  onChange={(e) => patchPage('homepage', { heroColumnOrder: e.target.value })}
                  className={editorInputClass()}
                >
                  <option value="intro-left">Copy left · prizes right</option>
                  <option value="prizes-left">Prizes left · copy right</option>
                </select>
              </EditorField>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Live promotion badge</h2>
              <HomeBlockVisibilityToggle
                blockId="promo_strip"
                block={promo}
                onChange={(visible) => patchHomeBlock('promo_strip', { visible })}
              />
            </div>
            <EditorField label="Badge label">
              <input
                value={promo.livePromotionLabel || ''}
                onChange={(e) => patchHomeBlock('promo_strip', { livePromotionLabel: e.target.value })}
                className={editorInputClass()}
              />
            </EditorField>
          </section>

          <section
            id="editor-block-hero_intro"
            className={`rounded-xl border bg-stone-900/40 p-4 ${
              ['hero_intro', 'promo_strip', 'hero'].includes(selectedBlockId) ? 'border-teal-500/40 ring-1 ring-teal-500/20' : 'border-white/10'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Hero copy</h2>
              <HomeBlockVisibilityToggle
                blockId="hero_intro"
                block={intro}
                onChange={(visible) => patchHomeBlock('hero_intro', { visible })}
              />
            </div>
            <div className="mt-3 grid gap-3">
              <EditorField label="Brand title">
                <input
                  value={intro.brandTitle || ''}
                  onChange={(e) => patchHomeBlock('hero_intro', { brandTitle: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Headline">
                <textarea
                  rows={3}
                  value={intro.headline || ''}
                  onChange={(e) => patchHomeBlock('hero_intro', { headline: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Highlighted phrase (green pen)">
                <input
                  value={intro.highlightPhrase || ''}
                  onChange={(e) => patchHomeBlock('hero_intro', { highlightPhrase: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Consolation copy">
                <textarea
                  rows={2}
                  value={intro.consolationCopy || ''}
                  onChange={(e) => patchHomeBlock('hero_intro', { consolationCopy: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Helper copy">
                <textarea
                  rows={2}
                  value={intro.helperCopy || ''}
                  onChange={(e) => patchHomeBlock('hero_intro', { helperCopy: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Prize panel & CTA</h2>
              <HomeBlockVisibilityToggle
                blockId="hero_prizes"
                block={prizes}
                onChange={(visible) => patchHomeBlock('hero_prizes', { visible })}
              />
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Drag prize images on the preview using the ⋮ handles on each image, then Save homepage.
            </p>
            <div className="mt-3 grid gap-3">
              <EditorField label="CTA blurb">
                <textarea
                  rows={3}
                  value={prizes.ctaBlurb || ''}
                  onChange={(e) => patchHomeBlock('hero_prizes', { ctaBlurb: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Enter button label">
                <input
                  value={prizes.ctaButtonLabel || ''}
                  onChange={(e) => patchHomeBlock('hero_prizes', { ctaButtonLabel: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
            </div>
            <p className="mt-2 text-xs text-stone-500">Prize images are fixed assets — use Competitions admin for catalog images.</p>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Bundle details title</h2>
              <HomeBlockVisibilityToggle
                blockId="hero_details"
                block={details}
                onChange={(visible) => patchHomeBlock('hero_details', { visible })}
              />
            </div>
            <EditorField label="Card title">
              <input
                value={details.title || ''}
                onChange={(e) => patchHomeBlock('hero_details', { title: e.target.value })}
                className={editorInputClass()}
              />
            </EditorField>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Ticket bundles</h2>
              <HomeBlockVisibilityToggle
                blockId="ticket_bundles"
                block={homepage.blocks.ticket_bundles}
                onChange={(visible) => patchHomeBlock('ticket_bundles', { visible })}
              />
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Bundle prices and labels come from Admin → Competitions. Toggle off to hide the ticket list on the homepage.
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Competitions hub</h2>
              <HomeBlockVisibilityToggle
                blockId="competitions_hub"
                block={homepage.blocks.competitions_hub}
                onChange={(visible) => patchHomeBlock('competitions_hub', { visible })}
              />
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Paid Legacy Bundle and free giveaways — shown below the hero. Drag &quot;Competitions hub&quot; in section order to move it.
            </p>
            <div className="mt-3 grid gap-3">
              <EditorField label="Section title">
                <input
                  value={homepage.blocks.competitions_hub?.title || ''}
                  onChange={(e) => patchHomeBlock('competitions_hub', { title: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Section intro">
                <textarea
                  rows={2}
                  value={homepage.blocks.competitions_hub?.subtitle || ''}
                  onChange={(e) => patchHomeBlock('competitions_hub', { subtitle: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Paid block title">
                <input
                  value={homepage.blocks.competitions_hub?.paidTitle || ''}
                  onChange={(e) => patchHomeBlock('competitions_hub', { paidTitle: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Paid block subtitle">
                <textarea
                  rows={2}
                  value={homepage.blocks.competitions_hub?.paidSubtitle || ''}
                  onChange={(e) => patchHomeBlock('competitions_hub', { paidSubtitle: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Separator label">
                <input
                  value={homepage.blocks.competitions_hub?.separatorLabel || ''}
                  onChange={(e) => patchHomeBlock('competitions_hub', { separatorLabel: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Free block title">
                <input
                  value={homepage.blocks.competitions_hub?.freeTitle || ''}
                  onChange={(e) => patchHomeBlock('competitions_hub', { freeTitle: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Free block subtitle">
                <textarea
                  rows={2}
                  value={homepage.blocks.competitions_hub?.freeSubtitle || ''}
                  onChange={(e) => patchHomeBlock('competitions_hub', { freeSubtitle: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Winners panel</h2>
              <HomeBlockVisibilityToggle
                blockId="winners_panel"
                block={winners}
                onChange={(visible) => patchHomeBlock('winners_panel', { visible })}
              />
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Shown when enabled and winners exist (from draws or manual rows in Homepage designer).
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <EditorField label="Section title">
                <input
                  value={winners.title || ''}
                  onChange={(e) => patchHomeBlock('winners_panel', { title: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Max items">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={winners.maxItems || 6}
                  onChange={(e) => patchHomeBlock('winners_panel', { maxItems: Number(e.target.value) })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Subtitle">
                <textarea
                  rows={2}
                  value={winners.subtitle || ''}
                  onChange={(e) => patchHomeBlock('winners_panel', { subtitle: e.target.value })}
                  className={editorInputClass('sm:col-span-2')}
                />
              </EditorField>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Social links (shirt form)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {['tiktok', 'instagram', 'facebook'].map((key) => (
                <EditorField key={key} label={key}>
                  <input
                    value={homepage.socialLinks?.[key] || ''}
                    onChange={(e) =>
                      patchPage('homepage', {
                        socialLinks: { ...homepage.socialLinks, [key]: e.target.value },
                      })
                    }
                    placeholder={`@${DEFAULT_SOCIAL_HANDLE} or full URL`}
                    className={editorInputClass()}
                  />
                </EditorField>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!loading && settingsTarget === 'page' && activePage === COMPETITIONS_PAGE_ID ? (
        <CompetitionsPageEditor
          layout={comp}
          selectedBlockId={selectedBlockId}
          editorViewport={editorViewport}
          onChange={(patch) => patchPage(COMPETITIONS_PAGE_ID, patch)}
        />
      ) : null}

      {!loading && settingsTarget === 'page' && activePage === FAQ_PAGE_ID ? (
        <SimplePageEditor
          layout={pages.faq}
          fields={[
            { key: 'title', label: 'Page title', type: 'text' },
            { key: 'subtitle', label: 'Intro paragraph', type: 'textarea', rows: 3 },
          ]}
          toggles={[
            { key: 'showSearch', label: 'Show search box' },
            { key: 'showPopular', label: 'Show popular questions' },
          ]}
          note="FAQ answers stay in the codebase for legal accuracy. Only the page title and intro are editable here."
          onChange={(patch) => patchPage(FAQ_PAGE_ID, patch)}
        />
      ) : null}

      {!loading && settingsTarget === 'page' && activePage === CONTACT_PAGE_ID ? (
        <SimplePageEditor
          layout={pages.contact}
          fields={[
            { key: 'eyebrow', label: 'Eyebrow label', type: 'text' },
            { key: 'title', label: 'Page title', type: 'text' },
            { key: 'intro', label: 'Intro text', type: 'textarea', rows: 3 },
          ]}
          toggles={[
            { key: 'showEmailCard', label: 'Show email card' },
            { key: 'showPostalCard', label: 'Show postal address card' },
          ]}
          onChange={(patch) => patchPage(CONTACT_PAGE_ID, patch)}
        />
      ) : null}

      {!loading && settingsTarget === 'page' && activePage === SHIRT_GIVEAWAY_PAGE_ID ? (
        <div className="space-y-6">
          <PageEditorImageField
            label="Prize shirt image"
            hint="Uses the original shirt artwork by default. Upload only if you need a replacement."
            imageUrl={pages.shirt_giveaway.prizeImageUrl || KICKUPS_GIVEAWAY_IMAGE}
            onUpload={async (file) => {
              const fd = new FormData()
              fd.append('image', file)
              const res = await apiFetch('/api/admin/competition-upload', { method: 'POST', body: fd })
              const j = await res.json().catch(() => ({}))
              if (!res.ok) throw new Error(j.error || 'Upload failed')
              patchPage(SHIRT_GIVEAWAY_PAGE_ID, { prizeImageRef: j.ref, prizeImageUrl: j.url })
            }}
            onClear={() => patchPage(SHIRT_GIVEAWAY_PAGE_ID, { prizeImageRef: null, prizeImageUrl: null })}
          />
          <SimplePageEditor
            layout={pages.shirt_giveaway}
            fields={[
              { key: 'badge', label: 'Top badge', type: 'text' },
              { key: 'title', label: 'Page title', type: 'text' },
              { key: 'intro', label: 'Intro paragraph', type: 'textarea', rows: 3 },
              { key: 'howToTitle', label: 'How-to section title', type: 'text' },
              { key: 'ctaButtonLabel', label: 'Form button label', type: 'text' },
            ]}
            onChange={(patch) => patchPage(SHIRT_GIVEAWAY_PAGE_ID, patch)}
          />
        </div>
      ) : null}

      {!loading && settingsTarget === 'page' && activePage === EMAIL_LAYOUT_PAGE_ID ? (
        <div className="space-y-6">
          <EmailEditorSettings
            layout={pages.emails}
            previewKind={emailPreviewKind}
            onPreviewKindChange={setEmailPreviewKind}
            onChange={(patch) => patchPage(EMAIL_LAYOUT_PAGE_ID, patch)}
          />
          <NewsletterEmailPreview
            layout={pages.emails}
            emailKind={emailPreviewKind}
            onEmailKindChange={setEmailPreviewKind}
            campaignBodyHtml={
              emailPreviewKind === 'campaign' ? pages.emails?.campaign?.bodyHtml : undefined
            }
          />
        </div>
      ) : null}
            </div>
          </PageEditorSettingsDrawer>
        </PageEditorPreviewProvider>
      )}
    </div>
  )
}

function SiteShellEditor({ shell, onChange, setPages }) {
  const navItems = shell.navOrder.map((id) => ({ id, label: shell.navItems[id]?.label || id }))

  return (
    <div className="space-y-6">
      <section id="editor-site-header" className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Header</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <EditorField label="Desktop tagline (right of logo)">
            <input
              value={shell.headerTagline || ''}
              onChange={(e) => onChange({ headerTagline: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Page background">
            <select
              value={shell.pageBackground}
              onChange={(e) => onChange({ pageBackground: e.target.value })}
              className={editorInputClass()}
            >
              <option value={SITE_PAGE_BACKGROUNDS.default}>Default gradient</option>
              <option value={SITE_PAGE_BACKGROUNDS.solid}>Solid dark</option>
            </select>
          </EditorField>
          <label className="flex items-center gap-2 text-sm text-stone-400 sm:col-span-2">
            <input
              type="checkbox"
              checked={shell.showHeaderTagline !== false}
              onChange={(e) => onChange({ showHeaderTagline: e.target.checked })}
            />
            Show header tagline on desktop
          </label>
        </div>
        <p className="mt-2 text-xs text-stone-500">Logo uses the ShowSkills brand asset — custom logo upload coming later.</p>
      </section>

      <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Main menu order</h2>
        <p className="mt-1 text-xs text-stone-500">Drag to reorder. Edit labels below.</p>
        <div className="mt-3">
          <DraggableSectionList
            items={navItems}
            onReorder={(ids) => onChange({ navOrder: ids })}
            renderExtra={(item) => (
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-stone-500">
                <input
                  type="checkbox"
                  checked={shell.navItems[item.id]?.visible !== false}
                  onChange={(e) =>
                    setPages((p) => ({
                      ...p,
                      site: mergeSiteShell({
                        ...p.site,
                        navItems: {
                          ...p.site.navItems,
                          [item.id]: { ...p.site.navItems[item.id], visible: e.target.checked },
                        },
                      }),
                    }))
                  }
                />
                Show
              </label>
            )}
          />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {shell.navOrder.map((id) => (
            <EditorField key={id} label={`Label: ${id}`}>
              <input
                value={shell.navItems[id]?.label || ''}
                onChange={(e) =>
                  setPages((p) => ({
                    ...p,
                    site: mergeSiteShell({
                      ...p.site,
                      navItems: {
                        ...p.site.navItems,
                        [id]: { ...p.site.navItems[id], label: e.target.value },
                      },
                    }),
                  }))
                }
                className={editorInputClass()}
              />
            </EditorField>
          ))}
        </div>
      </section>

      <section id="editor-site-footer" className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Footer</h2>
        <div className="mt-3 grid gap-3">
          <EditorField label="Disclaimer line">
            <input
              value={shell.footer?.disclaimer || ''}
              onChange={(e) => onChange({ footer: { ...shell.footer, disclaimer: e.target.value } })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Legal notice (leave blank for default)">
            <textarea
              rows={2}
              value={shell.footer?.legalNotice || ''}
              onChange={(e) => onChange({ footer: { ...shell.footer, legalNotice: e.target.value } })}
              className={editorInputClass()}
            />
          </EditorField>
          <label className="flex items-center gap-2 text-sm text-stone-400">
            <input
              type="checkbox"
              checked={shell.footer?.showTrustpilot !== false}
              onChange={(e) => onChange({ footer: { ...shell.footer, showTrustpilot: e.target.checked } })}
            />
            Show Trustpilot widget in footer
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-400">
            <input
              type="checkbox"
              checked={shell.footer?.showSocial !== false}
              onChange={(e) => onChange({ footer: { ...shell.footer, showSocial: e.target.checked } })}
            />
            Show social links in footer
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {['tiktok', 'instagram', 'facebook'].map((key) => (
            <EditorField key={key} label={`Footer ${key}`}>
              <input
                value={shell.footer?.socialLinks?.[key] || ''}
                onChange={(e) =>
                  onChange({
                    footer: {
                      ...shell.footer,
                      socialLinks: { ...shell.footer?.socialLinks, [key]: e.target.value },
                    },
                  })
                }
                placeholder={`@${DEFAULT_SOCIAL_HANDLE} or full URL`}
                className={editorInputClass()}
              />
            </EditorField>
          ))}
        </div>
      </section>
    </div>
  )
}

function CompetitionsPageEditor({ layout, selectedBlockId, editorViewport, onChange }) {
  const editingMobile = editorViewport === EDITOR_VIEWPORT_MOBILE
  const offsetBucket = editingMobile ? 'mobileOffsets' : 'offsets'
  const LEGACY_PANEL_RESET = {
    imagery: { x: 0, y: 0, scale: 1 },
    meta: { x: 0, y: 0, scale: 1 },
    timer: { x: 0, y: 0, scale: 1 },
    title: { x: 0, y: 0, scale: 1 },
    summary: { x: 0, y: 0, scale: 1 },
    price: { x: 0, y: 0, scale: 1 },
    enter: { x: 0, y: 0, scale: 1 },
  }
  const SHIRT_PANEL_RESET = {
    imagery: { x: 0, y: 0, scale: 1 },
    badge: { x: 0, y: 0, scale: 1 },
    title: { x: 0, y: 0, scale: 1 },
    prizeLine: { x: 0, y: 0, scale: 1 },
    helper: { x: 0, y: 0, scale: 1 },
    timer: { x: 0, y: 0, scale: 1 },
    steps: { x: 0, y: 0, scale: 1 },
    enter: { x: 0, y: 0, scale: 1 },
  }
  const sectionItems = (layout.sectionOrder || ['paid', 'free']).map((id) => ({
    id,
    label: layout.sections[id]?.title || id,
  }))
  const legacyCard = { ...defaultLegacyBundleCardLayout(), ...(layout.legacyBundleCard || {}) }
  const shirtCard = { ...defaultShirtGiveawayCardLayout(), ...(layout.shirtGiveawayCard || {}) }
  const showLegacyCardSettings = true
  const legacyBlockSelected = selectedBlockId?.startsWith('comp_paid_card')
  const shirtBlockSelected =
    selectedBlockId === 'comp_shirt' || selectedBlockId?.startsWith('comp_shirt_card')

  function patchLegacyCard(patch) {
    const { offsets, mobileOffsets, ...rest } = patch
    const next = { ...legacyCard, ...rest }
    if (offsets) next.offsets = { ...(legacyCard.offsets || {}), ...offsets }
    if (mobileOffsets) next.mobileOffsets = { ...(legacyCard.mobileOffsets || {}), ...mobileOffsets }
    onChange({ legacyBundleCard: next })
  }

  function patchShirtCard(patch) {
    const { offsets, mobileOffsets, ...rest } = patch
    const next = { ...shirtCard, ...rest }
    if (offsets) next.offsets = { ...(shirtCard.offsets || {}), ...offsets }
    if (mobileOffsets) next.mobileOffsets = { ...(shirtCard.mobileOffsets || {}), ...mobileOffsets }
    onChange({ shirtGiveawayCard: next })
  }

  function patchShirtStepLabel(index, value) {
    const next = [...(shirtCard.stepLabels || defaultShirtGiveawayCardLayout().stepLabels)]
    next[index] = value
    patchShirtCard({ stepLabels: next })
  }

  function patchSection(id, patch) {
    onChange({
      sections: {
        ...layout.sections,
        [id]: { ...layout.sections[id], ...patch },
      },
    })
  }

  return (
    <div className="space-y-6">
      <MobileLayoutSettingsPanel
        editorViewport={editorViewport}
        onResetPageMobile={() => onChange({ mobileOffsets: {} })}
        onResetLegacyMobile={() => patchLegacyCard({ [offsetBucket]: LEGACY_PANEL_RESET })}
        onResetShirtMobile={() => patchShirtCard({ [offsetBucket]: SHIRT_PANEL_RESET })}
      />
      <p className="text-xs leading-relaxed text-stone-500">
        {editingMobile ? (
          <>
            Mobile layout mode — drag blocks in the narrow preview. Positions save separately from desktop.{' '}
            <strong className="text-stone-300">Save Competitions</strong> when done.
          </>
        ) : (
          <>
            Click each text block in the preview — drag to move, Ctrl/Cmd+drag to resize. Alignment toolbar:{' '}
            <strong className="text-stone-400">X/Y/·</strong> center in panel,{' '}
            <strong className="text-stone-400">↔/↕/⊡</strong> center between neighbours,{' '}
            <strong className="text-stone-400">≡</strong> match sibling centers. Then{' '}
            <strong className="text-stone-300">Save Competitions</strong>.
          </>
        )}
      </p>

      {showLegacyCardSettings ? (
        <section
          id="editor-block-legacy_bundle_card"
          className={`rounded-xl border bg-stone-900/40 p-4 ${
            legacyBlockSelected ? 'border-teal-500/40 ring-1 ring-teal-500/20' : 'border-white/10'
          }`}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Legacy Bundle card</h2>
          {legacyBlockSelected && COMPETITIONS_BLOCK_LABELS[selectedBlockId] ? (
            <p className="mt-1 text-xs font-medium text-teal-400/90">
              Selected in preview: {COMPETITIONS_BLOCK_LABELS[selectedBlockId]} — drag to move, Ctrl/Cmd+drag to resize,
              toolbar above block for panel + neighbour alignment.
            </p>
          ) : (
            <p className="mt-1 text-xs text-stone-500">
              Click a block in the preview to select it. Toolbar appears above the selection — use ↔/↕/⊡ to center
              between neighbouring blocks (e.g. timer between meta and title).
            </p>
          )}
          <div className="mt-3 grid gap-3">
            <EditorField label="Meta label (above timer)">
              <input
                value={legacyCard.metaFeaturedLabel || ''}
                onChange={(e) => patchLegacyCard({ metaFeaturedLabel: e.target.value })}
                placeholder="Featured · Main prize"
                className={editorInputClass()}
              />
            </EditorField>
            <EditorField label="Title (leave blank for competition name)">
              <input
                value={legacyCard.title || ''}
                onChange={(e) => patchLegacyCard({ title: e.target.value })}
                placeholder="Ronaldo Legacy Bundle"
                className={editorInputClass()}
              />
            </EditorField>
            <EditorField label="Summary (below title)">
              <textarea
                rows={3}
                value={legacyCard.summary || ''}
                onChange={(e) => patchLegacyCard({ summary: e.target.value })}
                placeholder="Pay for ticket bundles or use free entry routes…"
                className={editorInputClass()}
              />
            </EditorField>
            <EditorField label="Space between timer, title & summary (px)">
              <input
                type="number"
                min={0}
                max={48}
                step={1}
                value={legacyCard.headlineGapPx ?? 14}
                onChange={(e) => patchLegacyCard({ headlineGapPx: Number(e.target.value) || 0 })}
                className={editorInputClass()}
              />
            </EditorField>
            <EditorField label="Enter button label">
              <input
                value={legacyCard.enterButtonLabel || ''}
                onChange={(e) => patchLegacyCard({ enterButtonLabel: e.target.value })}
                placeholder="Enter this competition"
                className={editorInputClass()}
              />
            </EditorField>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => patchLegacyCard({ [offsetBucket]: LEGACY_PANEL_RESET })}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-stone-400 hover:bg-white/5"
              >
                Reset card panel positions{editingMobile ? ' (mobile)' : ''}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    [offsetBucket]: {
                      ...(layout[offsetBucket] || layout.offsets || {}),
                      paidPrimaryCard: { x: 0, y: 0, scale: 1 },
                    },
                  })
                }
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-stone-400 hover:bg-white/5"
              >
                Reset whole card position{editingMobile ? ' (mobile)' : ''}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="editor-block-shirt_giveaway_card"
        className={`rounded-xl border bg-stone-900/40 p-4 ${
          shirtBlockSelected ? 'border-lime-500/40 ring-1 ring-lime-500/20' : 'border-white/10'
        }`}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Shirt giveaway card</h2>
        {shirtBlockSelected && COMPETITIONS_BLOCK_LABELS[selectedBlockId] ? (
          <p className="mt-1 text-xs font-medium text-lime-400/90">
            Selected in preview: {COMPETITIONS_BLOCK_LABELS[selectedBlockId]} — drag to move, Ctrl/Cmd+drag to resize,
            toolbar above block for panel + neighbour alignment.
          </p>
        ) : (
          <p className="mt-1 text-xs text-stone-500">
            Click a block in the free giveaways card to select it. Edit copy here or drag blocks in the preview.
          </p>
        )}
        <div className="mt-3 grid gap-3">
          <EditorField label="Prize image URL (leave blank for default)">
            <input
              value={shirtCard.prizeImageUrl || ''}
              onChange={(e) => patchShirtCard({ prizeImageUrl: e.target.value })}
              placeholder="/uploads/… or https://…"
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Badge label">
            <input
              value={shirtCard.badgeLabel || ''}
              onChange={(e) => patchShirtCard({ badgeLabel: e.target.value })}
              placeholder="Free giveaway"
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Title">
            <input
              value={shirtCard.title || ''}
              onChange={(e) => patchShirtCard({ title: e.target.value })}
              placeholder="Ronaldo Shirt Giveaway"
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Prize line">
            <input
              value={shirtCard.prizeLine || ''}
              onChange={(e) => patchShirtCard({ prizeLine: e.target.value })}
              placeholder="Signed Ronaldo United shirt…"
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Helper line (under prize)">
            <input
              value={shirtCard.helperLine || ''}
              onChange={(e) => patchShirtCard({ helperLine: e.target.value })}
              placeholder="No payment or video upload."
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Steps box heading">
            <input
              value={shirtCard.stepsHeading || ''}
              onChange={(e) => patchShirtCard({ stepsHeading: e.target.value })}
              placeholder="What you need to do"
              className={editorInputClass()}
            />
          </EditorField>
          {(shirtCard.stepLabels || defaultShirtGiveawayCardLayout().stepLabels).map((step, index) => (
            <EditorField key={index} label={`Step ${index + 1} title`}>
              <input
                value={step || ''}
                onChange={(e) => patchShirtStepLabel(index, e.target.value)}
                placeholder={['Answer the skill question correctly', 'Subscribe to our newsletter', 'Follow us on social media', 'Enter your details', 'Submit your entry'][index] || ''}
                className={editorInputClass()}
              />
            </EditorField>
          ))}
          <EditorField label="Full steps link label">
            <input
              value={shirtCard.stepsLinkLabel || ''}
              onChange={(e) => patchShirtCard({ stepsLinkLabel: e.target.value })}
              placeholder="Full entry steps"
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Space between card blocks (px)">
            <input
              type="number"
              min={0}
              max={48}
              step={1}
              value={shirtCard.headlineGapPx ?? 12}
              onChange={(e) => patchShirtCard({ headlineGapPx: Number(e.target.value) || 0 })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Enter button label">
            <input
              value={shirtCard.enterButtonLabel || ''}
              onChange={(e) => patchShirtCard({ enterButtonLabel: e.target.value })}
              placeholder="Enter free giveaway"
              className={editorInputClass()}
            />
          </EditorField>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => patchShirtCard({ [offsetBucket]: SHIRT_PANEL_RESET })}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-stone-400 hover:bg-white/5"
            >
              Reset card panel positions{editingMobile ? ' (mobile)' : ''}
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  [offsetBucket]: {
                    ...(layout[offsetBucket] || layout.offsets || {}),
                    shirtCard: { x: 0, y: 0, scale: 1 },
                  },
                })
              }
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-stone-400 hover:bg-white/5"
            >
              Reset whole card position{editingMobile ? ' (mobile)' : ''}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Page header</h2>
        <div className="mt-3 grid gap-3">
          <EditorField label="Page title">
            <input
              value={layout.title || ''}
              onChange={(e) => onChange({ title: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Intro paragraph">
            <textarea
              rows={3}
              value={layout.intro || ''}
              onChange={(e) => onChange({ intro: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Links under intro</h2>
        <div className="mt-3 grid gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-400">
            <input
              type="checkbox"
              checked={layout.showFaqLink !== false}
              onChange={(e) => onChange({ showFaqLink: e.target.checked })}
            />
            Show FAQ link
          </label>
          {layout.showFaqLink !== false ? (
            <EditorField label="FAQ link label">
              <input
                value={layout.faqLinkLabel || ''}
                onChange={(e) => onChange({ faqLinkLabel: e.target.value })}
                className={editorInputClass()}
              />
            </EditorField>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-stone-400">
            <input
              type="checkbox"
              checked={layout.showJumpLink !== false}
              onChange={(e) => onChange({ showJumpLink: e.target.checked })}
            />
            Show jump link to free giveaways
          </label>
          {layout.showJumpLink !== false ? (
            <EditorField label="Jump link label">
              <input
                value={layout.jumpLinkLabel || ''}
                onChange={(e) => onChange({ jumpLinkLabel: e.target.value })}
                className={editorInputClass()}
              />
            </EditorField>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Columns</h2>
        <p className="mt-1 text-xs text-stone-500">Reorder paid vs free columns. Toggle visibility per section.</p>
        <div className="mt-3">
          <DraggableSectionList
            items={sectionItems}
            onReorder={(ids) => onChange({ sectionOrder: ids })}
            renderExtra={(item) => (
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-stone-500">
                <input
                  type="checkbox"
                  checked={layout.sections[item.id]?.visible !== false}
                  onChange={(e) => patchSection(item.id, { visible: e.target.checked })}
                />
                Show
              </label>
            )}
          />
        </div>
        {layout.sectionOrder.map((id) => (
          <div key={id} className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-semibold uppercase text-stone-500">{id} column</p>
            <div className="mt-2 grid gap-2">
              <EditorField label="Section heading">
                <input
                  value={layout.sections[id]?.title || ''}
                  onChange={(e) => patchSection(id, { title: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
              <EditorField label="Section subtitle">
                <textarea
                  rows={2}
                  value={layout.sections[id]?.subtitle || ''}
                  onChange={(e) => patchSection(id, { subtitle: e.target.value })}
                  className={editorInputClass()}
                />
              </EditorField>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Empty states</h2>
        <p className="mt-1 text-xs text-stone-500">Shown when no published competitions or giveaways exist in that column.</p>
        <div className="mt-3 grid gap-3">
          <EditorField label="No paid competitions message">
            <textarea
              rows={2}
              value={layout.emptyPaidMessage || ''}
              onChange={(e) => onChange({ emptyPaidMessage: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="No extra giveaways message (optional)">
            <textarea
              rows={2}
              value={layout.emptyFreeMessage || ''}
              onChange={(e) => onChange({ emptyFreeMessage: e.target.value })}
              className={editorInputClass()}
              placeholder="Leave blank to show nothing"
            />
          </EditorField>
        </div>
      </section>
    </div>
  )
}

function SimplePageEditor({ layout, fields, toggles = [], note, onChange }) {
  return (
    <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
      {note ? <p className="mb-4 text-xs text-stone-500">{note}</p> : null}
      <div className="grid gap-3">
        {fields.map((f) => (
          <EditorField key={f.key} label={f.label}>
            {f.type === 'textarea' ? (
              <textarea
                rows={f.rows || 2}
                value={layout[f.key] || ''}
                onChange={(e) => onChange({ [f.key]: e.target.value })}
                className={editorInputClass()}
              />
            ) : (
              <input
                value={layout[f.key] || ''}
                onChange={(e) => onChange({ [f.key]: e.target.value })}
                className={editorInputClass()}
              />
            )}
          </EditorField>
        ))}
        {toggles.map((t) => (
          <label key={t.key} className="flex items-center gap-2 text-sm text-stone-400">
            <input
              type="checkbox"
              checked={layout[t.key] !== false}
              onChange={(e) => onChange({ [t.key]: e.target.checked })}
            />
            {t.label}
          </label>
        ))}
      </div>
    </section>
  )
}

function PageEditorImageField({ label, hint, imageUrl, onUpload, onClear }) {
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  async function pickFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,image/gif'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(true)
      setUploadErr('')
      try {
        await onUpload(file)
      } catch (e) {
        setUploadErr(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  return (
    <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">{label}</h2>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div className="ss-kickups-prize-thumb w-28 shrink-0 overflow-hidden rounded-lg border border-white/10">
          <img src={imageUrl} alt="" className="h-auto w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={pickFile}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload image'}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-stone-400 hover:bg-white/5"
          >
            Reset to default
          </button>
        </div>
      </div>
      {uploadErr ? <p className="mt-2 text-sm text-red-400">{uploadErr}</p> : null}
    </section>
  )
}
