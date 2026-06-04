import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { notifyLayoutUpdated } from '../../lib/publicDataCache.js'
import {
  HOMEPAGE_BLOCK_IDS,
  HOMEPAGE_HERO_BACKGROUNDS,
  defaultHomepageLayout,
  mergeHomepageLayout,
} from '../../../shared/homepageLayout.mjs'

function Field({ label, children }) {
  return (
    <label className="block text-sm text-stone-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function inputClass(extra = '') {
  return `w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100 ${extra}`
}

export default function HomepageDesignerPage() {
  const [layout, setLayout] = useState(defaultHomepageLayout())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/homepage-layout')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load')
      setLayout(mergeHomepageLayout(j.layout))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function patchBlock(blockId, patch) {
    setLayout((l) => ({
      ...l,
      blocks: {
        ...l.blocks,
        [blockId]: { ...l.blocks[blockId], ...patch },
      },
    }))
  }

  function moveBlock(id, dir) {
    setLayout((l) => {
      const order = [...l.blockOrder]
      const idx = order.indexOf(id)
      const next = idx + dir
      if (idx < 0 || next < 0 || next >= order.length) return l
      ;[order[idx], order[next]] = [order[next], order[idx]]
      return { ...l, blockOrder: order }
    })
  }

  function addManualWinner() {
    const list = layout.blocks.winners_panel.manualWinners || []
    patchBlock('winners_panel', {
      manualWinners: [...list, { name: '', prize: '', drawnAt: '' }],
    })
  }

  async function save() {
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const res = await apiFetch('/api/admin/homepage-layout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      setLayout(mergeHomepageLayout(j.layout))
      notifyLayoutUpdated('homepage')
      setMsg('Homepage saved — open the live site to see your changes.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const intro = layout.blocks.hero_intro
  const prizes = layout.blocks.hero_prizes
  const promo = layout.blocks.promo_strip
  const details = layout.blocks.hero_details
  const bundles = layout.blocks.ticket_bundles
  const winners = layout.blocks.winners_panel

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-100">Homepage designer</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            Edit homepage copy, section visibility, column layout, social links, and winners — saved to the database
            without code changes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-stone-300 hover:bg-white/5"
          >
            Preview live site
          </Link>
          <button
            type="button"
            disabled={saving || loading}
            onClick={save}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save homepage'}
          </button>
        </div>
      </div>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      {loading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {!loading ? (
        <>
          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Layout</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Hero background">
                <select
                  value={layout.heroBackground}
                  onChange={(e) => setLayout((l) => ({ ...l, heroBackground: e.target.value }))}
                  className={inputClass()}
                >
                  <option value={HOMEPAGE_HERO_BACKGROUNDS.kickups}>Pitch photo (default)</option>
                  <option value={HOMEPAGE_HERO_BACKGROUNDS.competitions}>Competitions photo</option>
                </select>
              </Field>
              <Field label="Desktop column order">
                <select
                  value={layout.heroColumnOrder}
                  onChange={(e) => setLayout((l) => ({ ...l, heroColumnOrder: e.target.value }))}
                  className={inputClass()}
                >
                  <option value="intro-left">Copy left · prizes right (default)</option>
                  <option value="prizes-left">Prizes left · copy right</option>
                </select>
              </Field>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              Block order (for future layout expansion):{' '}
              {layout.blockOrder.map((id) => (
                <span key={id} className="mr-2 inline-flex items-center gap-1 rounded bg-black/30 px-2 py-0.5 font-mono text-[10px]">
                  {id}
                  <button type="button" className="text-stone-500 hover:text-stone-300" onClick={() => moveBlock(id, -1)}>
                    ↑
                  </button>
                  <button type="button" className="text-stone-500 hover:text-stone-300" onClick={() => moveBlock(id, 1)}>
                    ↓
                  </button>
                </span>
              ))}
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Live promotion strip</h2>
              <label className="flex items-center gap-2 text-xs text-stone-400">
                <input
                  type="checkbox"
                  checked={promo.visible !== false}
                  onChange={(e) => patchBlock('promo_strip', { visible: e.target.checked })}
                />
                Visible
              </label>
            </div>
            <Field label="Badge label">
              <input
                value={promo.livePromotionLabel || ''}
                onChange={(e) => patchBlock('promo_strip', { livePromotionLabel: e.target.value })}
                className={inputClass()}
              />
            </Field>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Hero copy (left column)</h2>
              <label className="flex items-center gap-2 text-xs text-stone-400">
                <input
                  type="checkbox"
                  checked={intro.visible !== false}
                  onChange={(e) => patchBlock('hero_intro', { visible: e.target.checked })}
                />
                Visible
              </label>
            </div>
            <div className="mt-3 grid gap-3">
              <Field label="Brand title">
                <input
                  value={intro.brandTitle || ''}
                  onChange={(e) => patchBlock('hero_intro', { brandTitle: e.target.value })}
                  className={inputClass()}
                />
              </Field>
              <Field label="Headline">
                <textarea
                  rows={3}
                  value={intro.headline || ''}
                  onChange={(e) => patchBlock('hero_intro', { headline: e.target.value })}
                  className={inputClass()}
                />
              </Field>
              <Field label="Highlighted phrase (green pen style)">
                <input
                  value={intro.highlightPhrase || ''}
                  onChange={(e) => patchBlock('hero_intro', { highlightPhrase: e.target.value })}
                  className={inputClass()}
                />
              </Field>
              <Field label="Consolation copy">
                <textarea
                  rows={2}
                  value={intro.consolationCopy || ''}
                  onChange={(e) => patchBlock('hero_intro', { consolationCopy: e.target.value })}
                  className={inputClass()}
                />
              </Field>
              <Field label="Helper copy">
                <textarea
                  rows={2}
                  value={intro.helperCopy || ''}
                  onChange={(e) => patchBlock('hero_intro', { helperCopy: e.target.value })}
                  className={inputClass()}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Prize panel (right column)</h2>
              <label className="flex items-center gap-2 text-xs text-stone-400">
                <input
                  type="checkbox"
                  checked={prizes.visible !== false}
                  onChange={(e) => patchBlock('hero_prizes', { visible: e.target.checked })}
                />
                Visible
              </label>
            </div>
            <div className="mt-3 grid gap-3">
              <Field label="CTA blurb (under images)">
                <textarea
                  rows={3}
                  value={prizes.ctaBlurb || ''}
                  onChange={(e) => patchBlock('hero_prizes', { ctaBlurb: e.target.value })}
                  className={inputClass()}
                />
              </Field>
              <Field label="Enter button label">
                <input
                  value={prizes.ctaButtonLabel || ''}
                  onChange={(e) => patchBlock('hero_prizes', { ctaButtonLabel: e.target.value })}
                  className={inputClass()}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Bundle poster and phone images are fixed assets for now — use Competitions admin for catalog competition
              images.
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Lower panels</h2>
              <div className="flex flex-wrap gap-3 text-xs text-stone-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={details.visible !== false}
                    onChange={(e) => patchBlock('hero_details', { visible: e.target.checked })}
                  />
                  Bundle details
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bundles.visible !== false}
                    onChange={(e) => patchBlock('ticket_bundles', { visible: e.target.checked })}
                  />
                  Ticket bundles
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Winners panel</h2>
              <label className="flex items-center gap-2 text-xs text-stone-400">
                <input
                  type="checkbox"
                  checked={winners.visible !== false}
                  onChange={(e) => patchBlock('winners_panel', { visible: e.target.checked })}
                />
                Visible on homepage
              </label>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Shows draw winners from admin automatically, plus any manual rows below (e.g. before first draw).
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Section title">
                <input
                  value={winners.title || ''}
                  onChange={(e) => patchBlock('winners_panel', { title: e.target.value })}
                  className={inputClass()}
                />
              </Field>
              <Field label="Max items">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={winners.maxItems || 6}
                  onChange={(e) => patchBlock('winners_panel', { maxItems: Number(e.target.value) })}
                  className={inputClass()}
                />
              </Field>
              <Field label="Subtitle">
                <textarea
                  rows={2}
                  value={winners.subtitle || ''}
                  onChange={(e) => patchBlock('winners_panel', { subtitle: e.target.value })}
                  className={inputClass('sm:col-span-2')}
                />
              </Field>
            </div>
            <div className="mt-4 space-y-2">
              {(winners.manualWinners || []).map((w, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-3">
                  <input
                    placeholder="Name (e.g. Alex M.)"
                    value={w.name || ''}
                    onChange={(e) => {
                      const list = [...(winners.manualWinners || [])]
                      list[index] = { ...list[index], name: e.target.value }
                      patchBlock('winners_panel', { manualWinners: list })
                    }}
                    className={inputClass()}
                  />
                  <input
                    placeholder="Prize"
                    value={w.prize || ''}
                    onChange={(e) => {
                      const list = [...(winners.manualWinners || [])]
                      list[index] = { ...list[index], prize: e.target.value }
                      patchBlock('winners_panel', { manualWinners: list })
                    }}
                    className={inputClass()}
                  />
                  <input
                    type="date"
                    value={w.drawnAt ? w.drawnAt.slice(0, 10) : ''}
                    onChange={(e) => {
                      const list = [...(winners.manualWinners || [])]
                      list[index] = {
                        ...list[index],
                        drawnAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                      }
                      patchBlock('winners_panel', { manualWinners: list })
                    }}
                    className={inputClass()}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addManualWinner}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs text-stone-400 hover:bg-white/5"
              >
                Add manual winner
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-stone-900/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Shirt giveaway — Open profile links</h2>
            <p className="mt-2 text-sm text-stone-400">
              Managed in <strong className="text-stone-300">Site shell → Footer social links</strong> so the shirt form and
              footer use one Facebook (and TikTok / Instagram) URL.
            </p>
          </section>
        </>
      ) : null}
    </div>
  )
}
