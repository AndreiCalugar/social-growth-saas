import {
  UserPlus,
  Users,
  Sparkles,
  TrendingUp,
  FileText,
  Zap,
  RefreshCw,
  Clapperboard,
  Fish,
  Clock,
  Hash,
  ArrowRight,
  Check,
  Copy,
} from "lucide-react"
import { AddProfileModal } from "@/components/add-profile-modal"

export function OnboardingLanding() {
  return (
    <div className="min-h-full bg-white">
      <HeroSection />
      <HowItWorksSection />
      <WhatYouGetSection />
      <ExampleBriefSection />
      <SocialProofSection />
      <FinalCtaSection />
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-50 via-white to-white" aria-hidden />
      <div
        className="absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.15),transparent_60%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white/70 backdrop-blur px-3 py-1 text-[11px] font-semibold text-purple-700 shadow-sm">
          <Sparkles className="h-3 w-3" />
          AI-powered content strategy for Instagram creators
        </span>
        <h1 className="mt-6 text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.1]">
          Grow on Instagram with{" "}
          <span className="bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            data, not guesswork
          </span>
        </h1>
        <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
          We analyze your competitors and tell you exactly what content to create — with hooks,
          caption structure, hashtags, and the best time to post.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="#how-it-works"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 hover:bg-purple-700 hover:shadow-purple-500/50 transition-all"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#example"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-3"
          >
            See what a brief looks like
          </a>
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const steps = [
    {
      icon: UserPlus,
      title: "Add your profile",
      body:
        "Enter your Instagram username. We scrape your last 100 posts and analyze what's working for you.",
      accent: "from-purple-500 to-purple-700",
    },
    {
      icon: Users,
      title: "Add 3–5 competitors",
      body:
        "Add creators in your niche. We analyze their posts together to find patterns that consistently outperform.",
      accent: "from-purple-500 to-indigo-600",
    },
    {
      icon: Sparkles,
      title: "Get content briefs",
      body:
        "Our AI detects trends in your niche and gives you exact briefs: what to film, what hook to use, when to post.",
      accent: "from-amber-400 to-amber-600",
    },
  ]

  return (
    <section id="how-it-works" className="scroll-mt-8 py-16 sm:py-20 border-t border-slate-100">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-700">
            How it works
          </h2>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
            From zero to content briefs in 5 minutes
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={step.title}
                className="relative bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-purple-200 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`h-10 w-10 rounded-xl bg-gradient-to-br ${step.accent} flex items-center justify-center shadow-sm`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function WhatYouGetSection() {
  const features = [
    {
      icon: TrendingUp,
      title: "Trend Detection",
      body:
        "We identify content types getting 5–12× more engagement than average in your niche.",
      tint: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
    {
      icon: FileText,
      title: "Actionable Briefs",
      body:
        "Not just numbers — you get exactly what reel to make, with caption structure, hashtags, and posting time.",
      tint: "bg-purple-50 text-purple-600 border-purple-100",
    },
    {
      icon: Users,
      title: "Competitor Analysis",
      body:
        "Compare your performance against competitors and see what they do differently.",
      tint: "bg-orange-50 text-orange-600 border-orange-100",
    },
    {
      icon: RefreshCw,
      title: "Monthly Updates",
      body:
        "Trends change. We re-analyze monthly and give you fresh briefs based on new data.",
      tint: "bg-sky-50 text-sky-600 border-sky-100",
    },
  ]

  return (
    <section className="py-16 sm:py-20 bg-slate-50/60 border-y border-slate-100">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-700">
            What you get
          </h2>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
            Actionable intelligence, not dashboards
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${f.tint}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ExampleBriefSection() {
  return (
    <section id="example" className="scroll-mt-8 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-700">
            Example
          </h2>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
            What a brief looks like
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Every trend comes with a ready-to-film brief you can act on immediately.
          </p>
        </div>

        <ExampleInsightCard />
      </div>
    </section>
  )
}

function ExampleInsightCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-amber-500">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 leading-snug">
            Epic Journey Recap / Montage
          </h3>
          <span className="shrink-0 inline-flex items-baseline gap-0.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
            12.6
            <span className="text-[10px] font-semibold text-slate-300">×</span>
          </span>
        </div>

        <p className="mt-2 text-sm text-slate-600 leading-snug">
          Film a 60–90s rapid-cut montage of your best moments set to rising music.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Users className="h-3 w-3" />
            Found in 4 of 5 competitors
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-semibold border border-amber-100">
            <Zap className="h-3 w-3" /> Try this
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <BriefRow icon={Clapperboard} label="Content">
            60–90 second reel with rapid-cut clips (1–2 seconds each)
          </BriefRow>
          <BriefRow icon={Fish} label="Opening hook">
            &ldquo;You quit your job to bike across Europe?&rdquo; — text overlay on sweaty close-up
          </BriefRow>
          <BriefRow icon={FileText} label="Caption structure">
            Hook question → 3 lessons learned → CTA question to drive comments
          </BriefRow>
          <BriefRow icon={Clock} label="Best time to post">
            Thursday 6–8 PM
          </BriefRow>
          <BriefRow icon={Hash} label="Hashtags">
            <div className="flex flex-wrap gap-1.5">
              {["bikepacking", "adventurecycling", "biketour", "epicjourney", "solotravel"].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </BriefRow>

          <div
            aria-hidden
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-white select-none pointer-events-none opacity-80"
          >
            <Copy className="h-4 w-4" /> Copy Brief
          </div>
        </div>
      </div>
    </div>
  )
}

function BriefRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="text-sm text-slate-800 leading-relaxed">{children}</div>
    </div>
  )
}

function SocialProofSection() {
  return (
    <section className="py-12 border-y border-slate-100 bg-slate-50/60">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-sm text-slate-600 leading-relaxed">
          <Check className="inline h-4 w-4 text-emerald-600 mr-1 align-text-bottom" />
          Built by a creator for creators. Tested on real accounts with 13K+ followers.
        </p>
      </div>
    </section>
  )
}

function FinalCtaSection() {
  return (
    <section id="final-cta" className="scroll-mt-8 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-6">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">
          Ready to grow?
        </h2>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">
          Setup takes 5 minutes. Insights come immediately.
        </p>
        <div className="mt-8 flex justify-center">
          <AddProfileModal
            defaultIsOwn={true}
            triggerLabel="Add your first profile"
            triggerIcon={<UserPlus className="h-4 w-4" />}
            triggerClassName="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 hover:bg-purple-700 hover:shadow-purple-500/50 transition-all cursor-pointer"
          />
        </div>
        <p className="mt-4 text-xs text-slate-400">
          No credit card required · Free during beta
        </p>
      </div>
    </section>
  )
}
