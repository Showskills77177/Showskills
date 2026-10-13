export default function RecentWinnersPage() {
  return (
    <main className="min-h-[70svh] bg-gradient-to-b from-[#0b211a] via-[#071512] to-[#050d0b] px-4 py-12 text-stone-100 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mx-auto mb-9 max-w-2xl text-center sm:mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300">ShowSkills Rewards</p>
          <h1 className="mt-3 font-display text-5xl uppercase leading-none tracking-wide text-white sm:text-6xl">
            Recent winners
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-400 sm:text-base">
            Meet some of the people winning with ShowSkills Rewards.
          </p>
        </header>

        <article className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-[#0a1814] shadow-2xl shadow-black/30">
          <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="flex items-center justify-center bg-black/25 p-3 sm:p-5">
              <img
                src="/images/recent-winners/ayesha-mohd-shoeb-khan.jpeg"
                alt="Ayesha Mohd Shoeb Khan holding her ShowSkills Rewards winner's cheque"
                className="max-h-[36rem] w-full rounded-xl object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="flex flex-col justify-center px-6 py-8 sm:px-9 sm:py-10">
              <p className="w-fit rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                Winner
              </p>
              <h2 className="mt-4 font-display text-3xl uppercase leading-tight text-white sm:text-4xl">
                Ayesha Mohd Shoeb Khan
              </h2>
              <p className="mt-5 text-sm font-semibold leading-relaxed text-emerald-100 sm:text-base">
                World Cup Ball Question-Challenge Giveaway
              </p>
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Prize</p>
                <p className="mt-1 font-display text-3xl text-amber-200">USD $60.00</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Awarded</p>
                <p className="mt-1 text-sm text-stone-300">1 September 2026</p>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-stone-400">
                Congratulations to Ayesha on her win. Thanks for taking part in ShowSkills Rewards.
              </p>
            </div>
          </div>
        </article>
      </div>
    </main>
  )
}
