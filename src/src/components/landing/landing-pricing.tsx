import Link from "next/link"
import { Check, ArrowRight } from "lucide-react"

const FEATURES = [
  "Unlimited profiles and competitors",
  "Full insights engine access",
  "AI brief workshop",
  "Email support",
]

export function LandingPricing() {
  return (
    <section id="pricing" className="bg-slate-50/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-purple-600">
            Pricing
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Simple pricing
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Free during early access. Paid plans coming soon.
          </p>
        </div>

        <div className="mt-12 max-w-md mx-auto">
          <div className="relative rounded-2xl border border-purple-200/80 bg-white shadow-xl shadow-purple-200/40 overflow-hidden">
            <div
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-fuchsia-500"
              aria-hidden
            />
            <div className="p-8">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
                  Beta
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-2.5 py-1 text-[11px] font-semibold">
                  Early access
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-slate-900">
                  Free
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Everything you need to grow during beta.
              </p>

              <ul className="mt-6 space-y-3">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-purple-700 shrink-0">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 px-5 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition-colors"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>

              <p className="mt-3 text-center text-[11px] text-slate-500">
                No credit card required
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
