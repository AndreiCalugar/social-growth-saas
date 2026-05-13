import Link from "next/link"
import { ArrowRight, Users, Clapperboard, Fish, Clock, Zap } from "lucide-react"

const NOISE_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

export function LandingHero() {
  return (
    <section
      className="relative overflow-hidden text-white -mt-16 pt-16"
      style={{ backgroundColor: "#0b0a1f" }}
    >
      <div
        className="auth-blob-a absolute -top-40 -left-32 h-[55vw] w-[55vw] rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(circle, #6C3AED 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="auth-blob-b absolute top-1/4 -right-40 h-[55vw] w-[55vw] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, #312E81 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="auth-blob-c absolute -bottom-40 left-1/3 h-[45vw] w-[45vw] rounded-full opacity-55 blur-3xl"
        style={{ background: "radial-gradient(circle, #1E1B4B 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: NOISE_BG }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/80">
              <Zap className="h-3 w-3 text-amber-300" /> Free during early access
            </span>

            <h1 className="mt-5 text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]">
              Turn competitor data into your{" "}
              <span className="bg-gradient-to-r from-fuchsia-300 to-purple-200 bg-clip-text text-transparent">
                content strategy
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-white/75 leading-relaxed">
              We analyze your competitors&apos; top Instagram posts and tell you
              exactly what to create — with hooks, caption structure, hashtags,
              and the best time to post.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 px-6 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition-all"
              >
                Start free — no credit card required
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-3 text-xs text-white/55">
              Setup takes 5 minutes · Free during beta
            </p>
          </div>

          <div className="relative lg:pl-6">
            <div className="auth-float">
              <div className="auth-glow rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-xl p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                    Insights · Mega-tip
                  </span>
                  <span className="inline-flex items-baseline gap-0.5 rounded-full bg-white text-slate-900 px-2.5 py-1 text-xs font-bold tabular-nums">
                    31.4
                    <span className="text-[10px] font-semibold text-slate-500">×</span>
                  </span>
                </div>

                <h3 className="mt-3 text-base font-semibold text-white leading-snug">
                  Fast-cut coffee prep ASMR reel
                </h3>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/70">
                    <Users className="h-3 w-3 text-white/60" />
                    Found in 3 of 4 competitors
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 text-amber-200 px-2 py-0.5 text-[10px] font-semibold border border-amber-300/30">
                    <Zap className="h-2.5 w-2.5" /> Try this
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <GlassRow
                    icon={Clapperboard}
                    text="15-second reel with espresso machine sounds, no talking"
                  />
                  <GlassRow
                    icon={Fish}
                    text={`"Monday mood" text overlay on steaming cup close-up`}
                  />
                  <GlassRow icon={Clock} text="Tuesday 6–8 PM" />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["#coffeeshop", "#asmr", "#barista"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-white/10 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function GlassRow({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  text: string
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-white/70 mt-0.5 shrink-0" />
      <span className="text-xs text-white/90 leading-snug">{text}</span>
    </div>
  )
}
