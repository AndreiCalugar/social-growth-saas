import { TrendingUp, ClipboardList, Wand2, Swords } from "lucide-react"

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Trend Detection",
    body:
      "Discover content formats getting 10–50× more engagement in your niche.",
  },
  {
    icon: ClipboardList,
    title: "Ready-to-Film Briefs",
    body:
      "Each insight comes with opening hook, caption template, hashtags, and posting schedule.",
  },
  {
    icon: Wand2,
    title: "AI Brief Workshop",
    body:
      "Expand any brief with hook variations, format suggestions, and caption alternatives.",
  },
  {
    icon: Swords,
    title: "Competitor Intelligence",
    body:
      "See what your competitors do differently and how to level up.",
  },
]

export function LandingFeatures() {
  return (
    <section id="features" className="bg-slate-50/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-purple-600">
            Features
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            What you get
          </h2>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-2xl border border-slate-200/70 bg-white p-6 hover:shadow-lg hover:shadow-purple-100/50 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
