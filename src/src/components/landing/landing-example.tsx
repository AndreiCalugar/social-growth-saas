import { Clapperboard, Fish, Clock, Hash, Users, Zap } from "lucide-react"

export function LandingExample() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-purple-600">
            Example output
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            See what an insight looks like
          </h2>
          <p className="mt-3 text-base text-slate-600">
            A real mega-tip card. This is what you get for every winning pattern
            we detect across your competitors.
          </p>
        </div>

        <div className="mt-14 max-w-2xl mx-auto">
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xl shadow-purple-100/40 overflow-hidden">
            <div
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500"
              aria-hidden
            />

            <div className="p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Mega-tip
                </span>
                <span className="inline-flex items-baseline gap-0.5 rounded-full bg-slate-900 text-white px-2.5 py-1 text-xs font-bold tabular-nums">
                  31.4
                  <span className="text-[10px] font-semibold text-white/60">×</span>
                </span>
              </div>

              <h3 className="mt-3 text-xl font-semibold text-slate-900 leading-snug">
                Fast-cut coffee prep ASMR reel
              </h3>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Users className="h-3 w-3" />
                  Found in 3 of 4 competitors
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold border border-amber-200">
                  <Zap className="h-2.5 w-2.5" /> Try this
                </span>
              </div>

              <div className="mt-5 space-y-2.5">
                <DataRow
                  icon={Clapperboard}
                  label="Content"
                  value="15-second reel with espresso machine sounds, no talking"
                />
                <DataRow
                  icon={Fish}
                  label="Hook"
                  value={`"Monday mood" text overlay on steaming cup close-up`}
                />
                <DataRow icon={Clock} label="Best time" value="Tuesday 6–8 PM" />
                <DataRow
                  icon={Hash}
                  label="Hashtags"
                  value="#coffeeshop #asmr #barista"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DataRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-slate-50/70 border border-slate-100 px-3 py-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-500 shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
          {label}
        </div>
        <div className="text-sm text-slate-800 leading-snug">{value}</div>
      </div>
    </div>
  )
}
