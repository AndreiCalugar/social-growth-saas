import { UserPlus, Swords, Sparkles } from "lucide-react"

const STEPS = [
  {
    n: 1,
    icon: UserPlus,
    title: "Add your profile",
    body: "Enter your Instagram username. We scrape your last 100 posts.",
  },
  {
    n: 2,
    icon: Swords,
    title: "Add 3–5 competitors",
    body: "Add creators in your niche. We analyze their top posts together.",
  },
  {
    n: 3,
    icon: Sparkles,
    title: "Get actionable briefs",
    body: "AI detects winning patterns and gives you exact content briefs to film.",
  },
]

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="bg-white scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-purple-600">
            How it works
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            From zero to content briefs in 5 minutes
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6 lg:gap-8">
          {STEPS.map(({ n, icon: Icon, title, body }, i) => (
            <div key={n} className="relative">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-6 h-full">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 shadow-sm">
                    <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
                  </div>
                  <span className="text-xs font-semibold text-slate-400 tabular-nums">
                    Step {n}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{body}</p>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  className="hidden md:block absolute top-1/2 -right-4 lg:-right-5 -translate-y-1/2 text-slate-300"
                  aria-hidden
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
