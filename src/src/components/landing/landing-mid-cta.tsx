import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function LandingMidCta() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="relative overflow-hidden rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 px-6 py-8 sm:px-10 sm:py-10 text-center">
          <div
            className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-purple-300/30 blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-fuchsia-200/40 blur-3xl"
            aria-hidden
          />

          <div className="relative">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Ready to see what your competitors are doing?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Setup takes 5 minutes. Free during beta.
            </p>
            <Link
              href="/signup"
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 px-6 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
