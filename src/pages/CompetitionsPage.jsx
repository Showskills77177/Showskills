import { Link } from 'react-router-dom'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import iphone17ProMax from '../assets/iphone-17-pro-max-silver.png'
import { TicketBundlePrice } from '../components/siteChrome'
import { useEntryFlow } from '../entry/entryContext'

export default function CompetitionsPage() {
  const { openEntry } = useEntryFlow()

  return (
    <main className="m-0 p-0">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">Competitions</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">
          Main promotion: the Ronaldo Legacy Bundle draw — paid ticket bundles or free postal entry in the same panel,
          then three skill questions.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-stone-500">
          The separate{' '}
          <Link to="/archive/ronaldo-shirt-giveaway" className="font-medium text-teal-400 underline underline-offset-2 hover:text-teal-300">
            free Ronaldo shirt giveaway
          </Link>{' '}
          is kept off the homepage but remains available on its own page.
        </p>

        <ul className="mt-12 grid list-none gap-8 lg:max-w-2xl">
          <li className="flex flex-col overflow-hidden rounded-2xl border border-teal-500/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="bg-gradient-to-b from-teal-950/50 via-stone-950/80 to-stone-950 px-4 pb-4 pt-7">
              <div className="ss-bundle-frame mx-auto w-full max-w-xl">
                <img
                  src={legacyBundlePoster}
                  alt="Ronaldo Legacy Bundle promotional poster with signed shirt, signed ball and gold phone case."
                  width={1024}
                  height={576}
                  className="h-auto w-full"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="mx-auto mt-4 grid max-w-xl gap-3 rounded-xl border border-white/10 bg-black/25 p-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
                <div className="mx-auto w-full max-w-[7rem] overflow-hidden rounded-lg border border-white/10 bg-stone-950">
                  <img
                    src={iphone17ProMax}
                    alt="Silver iPhone 17 Pro Max prize photo."
                    width={768}
                    height={1024}
                    className="aspect-[3/4] h-auto w-full object-cover object-center"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-teal-300/90">Phone prize</p>
                  <p className="mt-1 text-sm font-semibold text-stone-100">iPhone 17 Pro Max</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Presented with the Legacy Bundle prize stack; final colour/spec may vary under substitution terms.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/90">Paid · Main prize</p>
              <h2 className="mt-2 font-display text-2xl text-white">Ronaldo Legacy Bundle</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-500">
                Pay for a ticket bundle <strong className="text-stone-400">or</strong> choose free postal entry in the same
                panel — then answer <strong className="text-stone-400">three skill questions</strong> in writing. All correct
                → you join the random draw for the full bundle (phone, shirt, ball, case).{' '}
                <strong className="text-stone-400">Not</strong> a video challenge.
              </p>
              <TicketBundlePrice className="mt-4" compact />
              <button
                type="button"
                onClick={() => openEntry('paid')}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
              >
                Enter this competition
              </button>
            </div>
          </li>
        </ul>
      </div>
    </main>
  )
}
