import { TrendingUp, Users, Clapperboard, Fish, Clock, Zap } from "lucide-react"

// Inline SVG noise turbulence for subtle texture over the gradient.
const NOISE_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

export function AuthShowcasePanel() {
  return (
    <aside
      className="relative hidden lg:flex lg:w-[55%] xl:w-[58%] overflow-hidden text-white"
      style={{ backgroundColor: "#0b0a1f" }}
    >
      {/* Animated gradient blobs */}
      <div
        className="auth-blob-a absolute -top-32 -left-32 h-[55vw] w-[55vw] rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(circle, #6C3AED 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="auth-blob-b absolute top-1/3 -right-40 h-[60vw] w-[60vw] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, #312E81 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="auth-blob-c absolute -bottom-48 left-1/4 h-[50vw] w-[50vw] rounded-full opacity-55 blur-3xl"
        style={{ background: "radial-gradient(circle, #1E1B4B 0%, transparent 70%)" }}
        aria-hidden
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: NOISE_BG }}
        aria-hidden
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col w-full p-10 xl:p-14">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 shadow-sm">
            <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">Social Growth</span>
        </div>

        {/* Hero content — vertically centered */}
        <div className="flex-1 flex flex-col justify-center max-w-xl">
          <h2 className="text-3xl xl:text-[2.6rem] font-bold tracking-tight leading-[1.1]">
            Your competitors already know what works.{" "}
            <span className="bg-gradient-to-r from-fuchsia-300 to-purple-200 bg-clip-text text-transparent">
              Now you will too.
            </span>
          </h2>

          {/* Glass preview card */}
          <div className="mt-8 auth-float">
            <div
              className="auth-glow rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-white leading-snug">
                  Epic Journey Montage
                </h3>
                <span className="shrink-0 inline-flex items-baseline gap-0.5 rounded-full bg-white text-slate-900 px-2.5 py-1 text-xs font-bold tabular-nums">
                  12.6
                  <span className="text-[10px] font-semibold text-slate-500">×</span>
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Users className="h-3 w-3 text-white/60" />
                <span className="text-[11px] text-white/70">Found in 4 of 5 competitors</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 text-amber-200 px-2 py-0.5 text-[10px] font-semibold border border-amber-300/30">
                  <Zap className="h-2.5 w-2.5" /> Try this
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <GlassRow icon={Clapperboard} text="60–90 second reel with rapid cuts" />
                <GlassRow
                  icon={Fish}
                  text={`"You quit your job to bike across Europe?"`}
                />
                <GlassRow icon={Clock} text="Thursday 6–8 PM" />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/70">
            <span className="font-medium">500+ posts analyzed</span>
            <span className="text-white/30">·</span>
            <span className="font-medium">12× avg trend detection</span>
            <span className="text-white/30">·</span>
            <span className="font-medium">Used by creators worldwide</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-white/50 tracking-wide">
          Free to start · No credit card required
        </p>
      </div>
    </aside>
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

/** Condensed mobile banner shown above the form when the big panel is hidden. */
export function AuthMobileBanner() {
  return (
    <div className="lg:hidden w-full bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
      <div className="max-w-md mx-auto px-6 py-6 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 border border-white/30">
            <TrendingUp className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-sm tracking-tight">Social Growth</span>
        </div>
        <h2 className="text-base font-bold leading-snug">
          Your competitors already know what works
        </h2>
        <p className="text-xs text-white/80 mt-1">
          Analyze competitors. Get content briefs. Grow faster.
        </p>
      </div>
    </div>
  )
}
