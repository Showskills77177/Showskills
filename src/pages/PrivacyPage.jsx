import { useEffect } from 'react'
import { TermsAndPrivacyBody } from '../components/TermsModal'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useSeoMeta } from '../hooks/useSeoMeta'

export default function PrivacyPage() {
  useSeoMeta({
    title: 'Privacy Policy | ShowSkills',
    description: 'How ShowSkills collects, uses, and protects your personal data across free quizzes and paid competitions.',
    path: '/privacy',
  })

  useEffect(() => {
    // The privacy policy is part of the combined terms document — scroll straight to it.
    const el = document.getElementById('privacy-policy-heading')
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [])

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">Privacy policy</h1>
        <p className="mt-3 text-sm text-stone-500">
          Our privacy policy is part of the combined ShowSkills terms document below.
        </p>
        <div className="ss-terms-modal-body mt-6 text-left text-base leading-relaxed text-zinc-400">
          <TermsAndPrivacyBody />
        </div>
      </div>
    </main>
  )
}
