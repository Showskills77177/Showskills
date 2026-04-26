import { Link } from 'react-router-dom'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import iphone17ProMax from '../assets/iphone-17-pro-max-silver.png'
import iphone17ProMaxGoldCase from '../assets/iphone-17-pro-max-gold-case.png'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import { TicketBundlePrice } from '../components/siteChrome'
import { useEntryFlow } from '../entry/entryContext'
import { SHIRT_GIVEAWAY_QUESTION } from '../../shared/shirtGiveaway.mjs'

export default function CompetitionsPage() {
  const { openEntry } = useEntryFlow()

  return (
    <main className="m-0 p-0">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">Competitions</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">
          Two live promotions for now: the Ronaldo Legacy Bundle draw and the free Ronaldo signed shirt giveaway.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-stone-500">
          The bundle uses paid ticket bundles or free postal entry, then three skill questions. The shirt giveaway is free:
          answer one simple qualification question to enter.
        </p>

        <ul className="mt-12 grid list-none gap-8 lg:grid-cols-2 lg:items-stretch">
          <li className="flex flex-col overflow-hidden rounded-2xl border border-teal-500/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="bg-gradient-to-b from-teal-950/50 via-stone-950/80 to-stone-950 px-4 pb-4 pt-7">
              <div className="ss-prize-studio mx-auto max-w-xl p-2 sm:p-3">
                <div className="relative z-[1] grid gap-2">
                  <div className="ss-prize-studio-tile ss-prize-studio-tile--main text-center">
                    <div className="ss-prize-studio-photo">
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
                  </div>
                  <div className="ss-prize-studio-subgrid mx-auto grid w-full gap-1.5 sm:max-w-[17rem] sm:grid-cols-2 sm:gap-0">
                    <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                      <div className="ss-prize-studio-photo mx-auto max-w-[7rem] rounded-md">
                        <img
                          src={iphone17ProMax}
                          alt="iPhone 17 Pro Max prize photo."
                          width={768}
                          height={1024}
                          className="aspect-[3/4] h-auto w-full scale-125 object-cover object-center"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <p className="ss-phone-prize-glow mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em]">
                        Phone prize
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-stone-100">iPhone 17 Pro Max</p>
                    </div>
                    <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                      <div className="ss-prize-studio-photo mx-auto max-w-[7rem] rounded-md">
                        <img
                          src={iphone17ProMaxGoldCase}
                          alt="24K gold case for iPhone 17 Pro Max prize photo."
                          width={960}
                          height={1024}
                          className="aspect-[3/4] h-auto w-full object-cover object-center"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em] text-amber-300/90">
                        Case prize
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-stone-100">24K gold case</p>
                    </div>
                  </div>
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
          <li className="flex flex-col overflow-hidden rounded-2xl border border-lime-400/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="bg-gradient-to-b from-lime-950/35 via-stone-950/80 to-stone-950 px-4 pb-4 pt-7">
              <div className="mx-auto flex max-w-sm flex-col items-center rounded-xl border border-lime-400/20 bg-black/25 p-4 text-center">
                <div className="w-full max-w-[14rem] overflow-hidden rounded-lg border border-lime-400/20 bg-black">
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
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.26em] text-lime-300/90">Free giveaway</p>
                <p className="mt-1 text-base font-semibold text-white">Ronaldo signed shirt</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-lime-300/90">Free · Shirt prize</p>
              <h2 className="mt-2 font-display text-2xl text-white">Ronaldo Shirt Giveaway</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-500">
                No payment. No video upload. Answer one qualification question and, if correct, you enter the random draw
                for the signed Ronaldo shirt only.
              </p>
              <div className="mt-4 rounded-xl border border-lime-400/20 bg-lime-950/15 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-lime-300/80">Question</p>
                <p className="mt-2 text-sm font-semibold leading-snug text-stone-100">{SHIRT_GIVEAWAY_QUESTION}</p>
              </div>
              <div className="mt-auto flex flex-col gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => openEntry('kickups')}
                  className="w-full rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 py-3.5 text-sm font-bold text-emerald-950 shadow-lg transition hover:brightness-110"
                >
                  Enter free giveaway
                </button>
                <Link
                  to="/archive/ronaldo-shirt-giveaway"
                  className="text-center text-xs font-medium text-stone-500 underline decoration-stone-600 underline-offset-4 hover:text-stone-300"
                >
                  View giveaway details
                </Link>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </main>
  )
}
