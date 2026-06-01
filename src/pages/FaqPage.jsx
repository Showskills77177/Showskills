import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Gift, HelpCircle, Mail, Search, Sparkles, Ticket } from 'lucide-react'
import {
  FAQ_PAGE_SUBTITLE,
  FAQ_PAGE_TITLE,
  FAQ_SECTIONS,
  filterFaqSections,
  getPopularFaqItems,
} from '../../shared/faqContent.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from '../../shared/siteContact.mjs'
import { UK_AVAILABILITY_NOTICE } from '../../shared/siteAvailability.mjs'
import { NO_PURCHASE_ENTRY_NOTICE } from '../../shared/competitionCopy.mjs'
import { useEntryFlow } from '../entry/entryContext'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { usePageLayout } from '../hooks/useSitePages'
import { FAQ_PAGE_ID } from '../../shared/sitePageLayout.mjs'

function FaqItemCard({ item, open, onToggle }) {
  const panelId = `faq-answer-${item.id}`
  const buttonId = `faq-question-${item.id}`

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071512]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] hover:border-white/[0.12]">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5 sm:py-4"
      >
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${
            open
              ? 'border-emerald-400/40 bg-emerald-950/50 text-emerald-300'
              : 'border-white/10 bg-white/[0.03] text-stone-500'
          }`}
          aria-hidden
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-stone-100 sm:text-base">{item.question}</span>
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className={open ? 'block' : 'hidden'}
      >
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
          <p className="text-sm leading-relaxed text-stone-400 sm:text-[15px] sm:leading-relaxed">{item.answer}</p>
        </div>
      </div>
    </div>
  )
}

export default function FaqPage() {
  const { openTerms } = useEntryFlow()
  const { layout: pageLayout } = usePageLayout(FAQ_PAGE_ID)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [activeSection, setActiveSection] = useState('all')
  const sectionRefs = useRef({})

  const filteredSections = useMemo(() => {
    let sections = filterFaqSections(FAQ_SECTIONS, query)
    if (activeSection !== 'all') {
      sections = sections.filter((s) => s.id === activeSection)
    }
    return sections
  }, [query, activeSection])

  const popularItems = useMemo(() => getPopularFaqItems(), [])
  const showPopular = pageLayout.showPopular !== false && !query.trim() && activeSection === 'all'
  const totalMatches = filteredSections.reduce((n, s) => n + s.items.length, 0)

  useEffect(() => {
    if (openId && !filteredSections.some((s) => s.items.some((i) => i.id === openId))) {
      setOpenId(null)
    }
  }, [filteredSections, openId])

  function scrollToSection(sectionId) {
    setActiveSection('all')
    setQuery('')
    requestAnimationFrame(() => {
      sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function openQuestion(item) {
    setActiveSection('all')
    setQuery('')
    setOpenId(item.id)
    requestAnimationFrame(() => {
      sectionRefs.current[item.sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      document.getElementById(`faq-question-${item.id}`)?.focus({ preventScroll: true })
    })
  }

  function toggleItem(id) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <main className="ss-photo-page ss-faq-page relative m-0 overflow-x-visible p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1]">
      {/* Hero */}
      <section className="relative overflow-visible border-b border-emerald-900/25">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Help centre
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.25rem,8vw,3.75rem)] uppercase leading-[0.95] tracking-[0.04em] text-white">
            {pageLayout.title || FAQ_PAGE_TITLE}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-400 sm:text-lg">
            {pageLayout.subtitle || FAQ_PAGE_SUBTITLE}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              to="/competitions"
              className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-950/30 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-950/50"
            >
              <Gift className="h-4 w-4 shrink-0" aria-hidden />
              View rewards &amp; competitions
            </Link>
            <button
              type="button"
              onClick={() => openTerms()}
              className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-stone-300 transition hover:bg-white/5"
            >
              <Ticket className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
              Full terms &amp; privacy
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pb-24 sm:pt-10">
        {/* UK notice */}
        <p className="rounded-2xl border border-amber-500/20 bg-amber-950/20 px-4 py-3.5 text-sm leading-relaxed text-amber-100/90">
          {UK_AVAILABILITY_NOTICE}
        </p>

        <p className="mt-4 rounded-2xl border border-teal-500/25 bg-teal-950/25 px-4 py-3.5 text-sm leading-relaxed text-teal-100/95">
          {NO_PURCHASE_ENTRY_NOTICE}
        </p>

        {/* Search */}
        {pageLayout.showSearch !== false ? (
        <label className="relative mt-8 block">
          <span className="sr-only">Search questions</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveSection('all')
            }}
            placeholder="Search rewards, tickets, quiz, winners…"
            className="w-full rounded-2xl border border-white/10 bg-stone-950/60 py-3.5 pl-12 pr-4 text-base text-stone-100 shadow-inner shadow-black/20 outline-none transition placeholder:text-stone-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20"
            autoComplete="off"
          />
        </label>
        ) : null}

        {pageLayout.showSearch !== false && query.trim() ? (
          <p className="mt-3 text-sm text-stone-500" aria-live="polite">
            {totalMatches === 0
              ? 'No questions match your search — try different words or browse a topic below.'
              : `${totalMatches} question${totalMatches === 1 ? '' : 's'} found`}
          </p>
        ) : null}

        {/* Topic pills — wrap / grid so labels are never clipped (no horizontal scroll trap) */}
        <div className="ss-faq-topic-list mt-5" role="tablist" aria-label="FAQ topics">
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'all'}
            onClick={() => setActiveSection('all')}
            className={`ss-faq-topic-pill ${
              activeSection === 'all'
                ? 'ss-faq-topic-pill--active'
                : 'ss-faq-topic-pill--idle'
            }`}
          >
            All topics
          </button>
          {FAQ_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              onClick={() => {
                setActiveSection(section.id)
                setQuery('')
              }}
              className={`ss-faq-topic-pill ${
                activeSection === section.id
                  ? 'ss-faq-topic-pill--active'
                  : 'ss-faq-topic-pill--idle'
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>

        <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          {/* Desktop jump nav */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 rounded-2xl border border-white/[0.08] bg-stone-950/50 p-3" aria-label="Jump to topic">
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">On this page</p>
              <ul className="space-y-0.5">
                {FAQ_SECTIONS.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full rounded-lg px-2.5 py-2 text-left text-xs leading-snug transition sm:text-sm ${
                        activeSection === section.id
                          ? 'bg-emerald-950/40 font-semibold text-emerald-200'
                          : 'text-stone-400 hover:bg-white/[0.04] hover:text-stone-200'
                      }`}
                    >
                      <span className="block whitespace-normal break-words">{section.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0 space-y-12">
            {/* Popular */}
            {showPopular ? (
              <section aria-labelledby="faq-popular-heading">
                <h2
                  id="faq-popular-heading"
                  className="flex items-center gap-2 font-display text-xl uppercase tracking-wide text-stone-100"
                >
                  <Sparkles className="h-5 w-5 text-emerald-400/90" strokeWidth={1.75} aria-hidden />
                  Popular questions
                </h2>
                <p className="mt-1 text-sm text-stone-500">Tap a question to jump straight to the full answer.</p>
                <ul className="mt-4 flex flex-col gap-2 sm:grid sm:grid-cols-2">
                  {popularItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openQuestion(item)}
                        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#071512]/80 px-4 py-3.5 text-left text-sm font-semibold text-stone-200 transition hover:border-emerald-500/30 hover:bg-emerald-950/20"
                      >
                        <span className="min-w-0 whitespace-normal break-words leading-snug">{item.question}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-emerald-500/70" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Sections */}
            {filteredSections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-stone-950/40 px-6 py-12 text-center">
                <HelpCircle className="mx-auto h-10 w-10 text-stone-600" strokeWidth={1.5} aria-hidden />
                <p className="mt-4 text-base font-medium text-stone-300">Nothing matched</p>
                <p className="mt-2 text-sm text-stone-500">
                  Clear your search or pick another topic. You can also{' '}
                  <Link to="/contact" className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200">
                    contact us
                  </Link>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setActiveSection('all')
                  }}
                  className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-stone-300 hover:bg-white/5"
                >
                  Show all questions
                </button>
              </div>
            ) : (
              filteredSections.map((section) => (
                <section
                  key={section.id}
                  id={`faq-section-${section.id}`}
                  ref={(el) => {
                    sectionRefs.current[section.id] = el
                  }}
                  className="scroll-mt-28"
                  aria-labelledby={`faq-${section.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-950/40"
                      aria-hidden
                    >
                      <HelpCircle className="h-5 w-5 text-emerald-400/90" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id={`faq-${section.id}`}
                        className="break-words font-display text-xl uppercase tracking-wide text-stone-100 sm:text-2xl"
                      >
                        {section.title}
                      </h2>
                      <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed text-stone-500">{section.summary}</p>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-2">
                    {section.items.map((item) => (
                      <li key={item.id} id={`faq-item-${item.id}`}>
                        <FaqItemCard item={item} open={openId === item.id} onToggle={() => toggleItem(item.id)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}

            {/* CTA */}
            <div className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 via-stone-950/80 to-[#071512] shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" aria-hidden />
              <div className="flex flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
                <div>
                  <p className="flex items-center gap-2 font-display text-xl uppercase tracking-wide text-stone-100">
                    <Mail className="h-5 w-5 text-emerald-400/90" aria-hidden />
                    Still need help?
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-400">
                    Our team can help with payments, quiz links, and prize questions. Use the{' '}
                    <Link
                      to="/contact"
                      className="font-medium text-emerald-300 underline decoration-emerald-600/40 underline-offset-2 hover:text-emerald-200"
                    >
                      contact form
                    </Link>{' '}
                    or email{' '}
                    <a
                      href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`}
                      className="font-medium text-emerald-300 underline decoration-emerald-600/40 underline-offset-2 hover:text-emerald-200"
                    >
                      {SHOWSKILLS_CONTACT_EMAIL}
                    </a>
                    . Include your order reference for ticket issues.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-56 sm:shrink-0">
                  <Link
                    to="/contact"
                    className="inline-flex min-h-[2.75rem] w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
                  >
                    Contact us
                  </Link>
                  <Link
                    to="/competitions"
                    className="inline-flex min-h-[2.75rem] w-full items-center justify-center rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-stone-300 transition hover:bg-white/5"
                  >
                    Enter a competition
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>
  )
}
