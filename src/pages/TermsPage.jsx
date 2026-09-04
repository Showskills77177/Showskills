import { TermsAndPrivacyBody } from '../components/TermsModal'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useSeoMeta } from '../hooks/useSeoMeta'

export default function TermsPage() {
  useSeoMeta({
    title: 'Terms & Privacy | ShowSkills',
    description: 'ShowSkills terms and conditions and privacy policy for free skill quizzes and paid competitions.',
    path: '/terms',
  })

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">Terms &amp; privacy</h1>
        <div className="ss-terms-modal-body mt-6 text-left text-base leading-relaxed text-zinc-400">
          <TermsAndPrivacyBody />
        </div>
      </div>
    </main>
  )
}
