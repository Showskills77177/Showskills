import { Link, useSearchParams } from 'react-router-dom'
import { ShirtPrizeRevealViewer } from '../components/ShirtPrizeRevealViewer'

export default function ShirtPrizeRevealPage() {
  const [params] = useSearchParams()
  const token = (params.get('token') || '').trim()

  return (
    <div className="ss-shirt-prize-reveal-page min-h-svh bg-[#050a09] text-stone-200">
      <header className="border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/competitions" className="text-sm font-medium text-lime-300/90 hover:text-lime-200">
            ← Competitions
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Shirt preview</span>
        </div>
      </header>
      <main className="px-4 py-10 sm:px-6 sm:py-14">
        {token.length >= 20 ? (
          <ShirtPrizeRevealViewer previewToken={token} />
        ) : (
          <div className="mx-auto max-w-md text-center">
            <h1 className="font-display text-2xl uppercase tracking-wide text-white">Invalid preview link</h1>
            <p className="mt-4 text-sm text-stone-400">
              Open the <strong className="text-stone-300">View shirt imagery</strong> button from your giveaway
              confirmation email.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
