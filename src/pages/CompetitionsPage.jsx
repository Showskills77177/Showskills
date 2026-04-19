import prizeBundle from '../assets/prize-bundle-hero.png'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import { KickupsNeonBall35, TicketBundlePrice } from '../components/siteChrome'
import { useEntryFlow } from '../entry/entryContext'

export default function CompetitionsPage() {
  const { openEntry } = useEntryFlow()

  return (
    <main className="m-0 p-0">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">Competitions</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">
          Two promotions: the full Legacy Bundle draw (paid bundles or free postal — both inside the same entry panel),
          and the separate 35 Kick-Ups shirt giveaway.
        </p>

        <ul className="mt-12 grid list-none gap-8 lg:grid-cols-2 lg:gap-8">
          <li className="flex flex-col overflow-hidden rounded-2xl border border-teal-500/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="flex justify-center bg-gradient-to-b from-teal-950/50 via-stone-950/80 to-stone-950 px-4 pb-2 pt-7">
              <div className="ss-bundle-frame w-full max-w-[14rem]">
                <img
                  src={prizeBundle}
                  alt="Ronaldo Legacy Bundle promotional artwork: shirt, signed ball, iPhone and gold case."
                  width={682}
                  height={1024}
                  className="h-auto w-full"
                  loading="lazy"
                  decoding="async"
                />
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

          <li className="flex flex-col overflow-hidden rounded-2xl border border-lime-500/30 bg-stone-950/50 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            <div className="flex justify-center border-b border-lime-500/35 bg-gradient-to-b from-lime-950/50 via-stone-950/80 to-stone-950 px-4 pb-2 pt-7">
              <div className="ss-bundle-frame w-full max-w-[14rem]">
                <img
                  src={KICKUPS_GIVEAWAY_IMAGE}
                  alt="Prize: signed Cristiano Ronaldo Manchester United number 7 shirt."
                  width={771}
                  height={1024}
                  className="h-auto w-full"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-lime-300/85">Free · Different prize</p>
              <h2 className="mt-2 font-display text-2xl text-white">35 Kick-Ups giveaway</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-500">
                Film <strong className="text-stone-400">35 kick-ups</strong> in one take (face visible, no cuts).{' '}
                <strong className="text-lime-200/80">Prize: signed shirt only.</strong> Does not include the phone or ball.
                Separate from the paid bundle competition.
              </p>
              <div className="flex min-h-[11rem] flex-1 flex-col items-center justify-center px-2 py-2">
                <KickupsNeonBall35 size="lg" />
              </div>
              <button
                type="button"
                onClick={() => openEntry('kickups')}
                className="mt-8 w-full rounded-xl bg-gradient-to-r from-lime-700 to-emerald-700 py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
              >
                Enter shirt giveaway
              </button>
            </div>
          </li>
        </ul>
      </div>
    </main>
  )
}
