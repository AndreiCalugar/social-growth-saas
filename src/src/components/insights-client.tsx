"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Sparkles,
  Users,
  Zap,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Check,
  Clapperboard,
  Fish,
  FileText,
  Clock,
  Hash,
  Copy,
  ArrowRight,
} from "lucide-react"
import { useJobTracker, useRotatingMessage, ESTIMATED_DURATION } from "@/components/job-tracker"

interface ExamplePost {
  caption_preview: string
  likes: number
  comments: number
  competitor: string
}

interface Insight {
  id: string
  trend_name: string
  confidence: number | null
  performance_multiplier: number | null
  example_posts: unknown
  recommendation: string | null
  is_mega_tip: boolean | null
  created_at: string
  // Structured brief fields — nullable until the Claude prompt + schema migration lands.
  one_line_summary?: string | null
  competitor_count?: number | null
  total_competitors?: number | null
  content_format?: string | null
  hook?: string | null
  caption_structure?: string | null
  best_time?: string | null
  hashtags?: string[] | null
}

interface Props {
  ownProfileId: string | null
  userId: string
  initialInsights: Insight[]
  competitorCount: number
}

function parseExamples(raw: unknown): ExamplePost[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return []
}

function dedupeExamples(examples: ExamplePost[]): ExamplePost[] {
  const seen = new Set<string>()
  const out: ExamplePost[] = []
  for (const ex of examples) {
    const comp = (ex.competitor || "").replace(/^@/, "").toLowerCase()
    if (!comp || seen.has(comp)) continue
    seen.add(comp)
    out.push(ex)
    if (out.length === 3) break
  }
  return out
}

function fmtLikes(n: number | null | undefined) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}

function firstSentence(s: string): string {
  const match = s.match(/^(.+?[.!?])\s/)
  return match ? match[1] : s
}

function buildSummary(insight: Insight): string {
  if (insight.one_line_summary) return truncate(insight.one_line_summary, 100)
  const rec = insight.recommendation ?? ""
  return truncate(firstSentence(rec), 100)
}

function competitorFractionLabel(insight: Insight, fallbackTotal: number): string | null {
  if (insight.competitor_count != null && insight.total_competitors != null) {
    return `Found in ${insight.competitor_count} of ${insight.total_competitors} competitors`
  }
  if (insight.confidence != null && fallbackTotal > 0) {
    const matched = Math.max(1, Math.round(insight.confidence * fallbackTotal))
    return `Found in ${matched} of ${fallbackTotal} competitors`
  }
  return null
}

function buildCopyText(insight: Insight, fraction: string | null): string {
  const mult = insight.performance_multiplier ?? 0
  const lines: string[] = []
  lines.push(`🎬 ${insight.trend_name}`)
  const meta: string[] = []
  if (mult > 0) meta.push(`${mult.toFixed(1)}× avg engagement`)
  if (fraction) meta.push(fraction)
  if (meta.length) lines.push(`📊 ${meta.join(" | ")}`)
  lines.push("")
  if (insight.content_format) lines.push(`CONTENT: ${insight.content_format}`)
  if (insight.hook) lines.push(`HOOK: ${insight.hook}`)
  if (insight.caption_structure) lines.push(`CAPTION: ${insight.caption_structure}`)
  if (insight.best_time) lines.push(`POST: ${insight.best_time}`)
  if (insight.hashtags && insight.hashtags.length) {
    lines.push(`TAGS: ${insight.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`)
  }
  if (
    !insight.content_format &&
    !insight.hook &&
    !insight.caption_structure &&
    insight.recommendation
  ) {
    lines.push(insight.recommendation)
  }
  return lines.join("\n")
}

function InsightCard({
  insight,
  fallbackTotalCompetitors,
}: {
  insight: Insight
  fallbackTotalCompetitors: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const multiplier = insight.performance_multiplier ?? 0
  const isMegaTip = insight.is_mega_tip === true
  const userDoingIt = insight.is_mega_tip === false
  const summary = buildSummary(insight)
  const fraction = competitorFractionLabel(insight, fallbackTotalCompetitors)
  const examples = dedupeExamples(parseExamples(insight.example_posts))
  const showExamples = examples.length >= 2

  const hasStructured = Boolean(
    insight.content_format ||
      insight.hook ||
      insight.caption_structure ||
      insight.best_time ||
      (insight.hashtags && insight.hashtags.length)
  )

  async function handleCopy() {
    const text = buildCopyText(insight, fraction)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all overflow-hidden border-l-4 ${
        isMegaTip ? "border-l-amber-500" : "border-l-emerald-500"
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Header: name + multiplier */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 leading-snug">
            {insight.trend_name}
          </h3>
          {multiplier > 0 && (
            <span className="shrink-0 inline-flex items-baseline gap-0.5 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-bold text-white tabular-nums shadow-sm">
              {multiplier.toFixed(1)}
              <span className="text-[11px] font-semibold text-slate-300">×</span>
            </span>
          )}
        </div>

        {/* One-line summary */}
        {summary && (
          <p className="mt-2 text-sm text-slate-600 leading-snug">{summary}</p>
        )}

        {/* Meta row: competitor count + status */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {fraction && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Users className="h-3 w-3" />
              {fraction}
            </span>
          )}
          {userDoingIt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold border border-emerald-100">
              <Check className="h-3 w-3" /> You&apos;re doing this
            </span>
          ) : isMegaTip ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-semibold border border-amber-100">
              <Zap className="h-3 w-3" /> Try this
            </span>
          ) : null}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-800"
        >
          {expanded ? "Hide breakdown" : "View full breakdown"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {/* Expanded content — grid-rows animation for smooth expand */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr] mt-4" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="pt-4 border-t border-slate-100 space-y-4">
              {/* Structured brief sections */}
              {hasStructured ? (
                <div className="space-y-3">
                  {insight.content_format && (
                    <BriefSection icon={Clapperboard} label="Content" tone="purple">
                      {insight.content_format}
                    </BriefSection>
                  )}
                  {insight.hook && (
                    <BriefSection icon={Fish} label="Opening hook" tone="amber">
                      {insight.hook}
                    </BriefSection>
                  )}
                  {insight.caption_structure && (
                    <BriefSection icon={FileText} label="Caption structure" tone="slate">
                      <span className="whitespace-pre-line">{insight.caption_structure}</span>
                    </BriefSection>
                  )}
                  {insight.best_time && (
                    <BriefSection icon={Clock} label="Best time to post" tone="emerald">
                      {insight.best_time}
                    </BriefSection>
                  )}
                  {insight.hashtags && insight.hashtags.length > 0 && (
                    <BriefSection icon={Hash} label="Hashtags" tone="slate">
                      <div className="flex flex-wrap gap-1.5">
                        {insight.hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            #{tag.replace(/^#/, "")}
                          </span>
                        ))}
                      </div>
                    </BriefSection>
                  )}
                </div>
              ) : insight.recommendation ? (
                <div
                  className={`rounded-lg px-4 py-3 ${
                    isMegaTip
                      ? "bg-amber-50 border border-amber-100"
                      : "bg-purple-50 border border-purple-100"
                  }`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                      isMegaTip ? "text-amber-700" : "text-purple-700"
                    }`}
                  >
                    {isMegaTip ? "⚡ Do this" : "Recommendation"}
                  </p>
                  <p
                    className={`text-sm leading-relaxed ${
                      isMegaTip ? "text-amber-900" : "text-purple-900"
                    }`}
                  >
                    {insight.recommendation}
                  </p>
                </div>
              ) : null}

              {/* Example posts — dedup + require 2+ unique competitors */}
              {showExamples && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Top examples
                  </p>
                  <div className="space-y-2">
                    {examples.map((ex, i) => {
                      const handle = ex.competitor.replace(/^@/, "")
                      const initial = handle.charAt(0).toUpperCase() || "?"
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                        >
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                @{handle}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 shrink-0">
                                {fmtLikes(ex.likes)} likes
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              {truncate(ex.caption_preview || "", 40)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Copy Brief button — full width, flashes emerald on success */}
              <button
                onClick={handleCopy}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition-all ${
                  copied
                    ? "bg-emerald-600"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copied to clipboard
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy Brief
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const briefTone: Record<
  "purple" | "amber" | "slate" | "emerald",
  { bg: string; border: string; icon: string; label: string }
> = {
  purple: { bg: "bg-purple-50/60", border: "border-purple-100", icon: "text-purple-600", label: "text-purple-700" },
  amber:  { bg: "bg-amber-50/60",  border: "border-amber-100",  icon: "text-amber-600",  label: "text-amber-700" },
  slate:  { bg: "bg-slate-50/80",  border: "border-slate-100",  icon: "text-slate-500",  label: "text-slate-500" },
  emerald:{ bg: "bg-emerald-50/60",border: "border-emerald-100",icon: "text-emerald-600",label: "text-emerald-700" },
}

function BriefSection({
  icon: Icon,
  label,
  children,
  tone = "slate",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  tone?: "purple" | "amber" | "slate" | "emerald"
}) {
  const t = briefTone[tone]
  return (
    <div className={`rounded-lg border ${t.border} ${t.bg} p-3`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${t.icon}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${t.label}`}>
          {label}
        </span>
      </div>
      <div className="text-sm text-slate-800 leading-relaxed">{children}</div>
    </div>
  )
}

export function InsightsClient({
  ownProfileId,
  userId,
  initialInsights,
  competitorCount,
}: Props) {
  const [insights, setInsights] = useState<Insight[]>(initialInsights)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const lastStatusRef = useRef<string | undefined>(undefined)

  const { jobs, startInsights, finishJob } = useJobTracker()
  const job = ownProfileId ? jobs.find((j) => j.id === `insights-${ownProfileId}`) : undefined
  const running = job?.status === "running"
  const rotatingMessage = useRotatingMessage("insights", running)
  const [lastRunEmpty, setLastRunEmpty] = useState(false)

  useEffect(() => {
    if (!ownProfileId) return
    const prev = lastStatusRef.current
    lastStatusRef.current = job?.status

    if (prev === "running" && job?.status === "done") {
      fetch(`/api/insights?profile_id=${ownProfileId}`)
        .then((r) => r.json())
        .then((json: { insights?: Insight[] }) => {
          if (json.insights) setInsights(json.insights)
        })
        .catch(() => {})
    }
    if (job?.status === "error" && job.errorMessage) {
      setErrorMsg(job.errorMessage)
    }
  }, [job?.status, job?.errorMessage, ownProfileId])

  async function handleGenerate() {
    if (!ownProfileId) {
      setErrorMsg("No own profile found. Add your own account in Profiles first.")
      return
    }

    setErrorMsg(null)
    setLastRunEmpty(false)
    const cursor = insights[0]?.created_at ?? ""
    startInsights({ ownProfileId, cursor })
    const jobId = `insights-${ownProfileId}`

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook/cross-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ own_profile_id: ownProfileId, user_id: userId }),
      })

      if (!res.ok) {
        const rawText = await res.text()
        throw new Error(`n8n webhook failed (${res.status}): ${rawText.slice(0, 300)}`)
      }
      // The webhook returns a definitive result. Use it to end the tracker job
      // immediately rather than waiting for polling — important for the
      // empty-result case, where no fresh DB row exists for polling to see.
      const body = (await res.json().catch(() => ({}))) as {
        trends_detected?: number
      }
      if (typeof body.trends_detected === "number" && body.trends_detected === 0) {
        setLastRunEmpty(true)
      }
      finishJob(jobId, { success: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      setErrorMsg(message)
      finishJob(jobId, { success: false, errorMessage: message })
    }
  }

  const status: "idle" | "generating" | "done" | "error" = running
    ? "generating"
    : errorMsg
    ? "error"
    : insights.length > 0
    ? "done"
    : "idle"

  const megaTips = insights.filter((i) => i.is_mega_tip)
  const otherInsights = insights.filter((i) => !i.is_mega_tip)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Insights Engine</h1>
          </div>
          <p className="text-sm text-slate-500">
            Cross-competitor trend detection across {competitorCount} accounts
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={status === "generating" || !ownProfileId}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm w-full sm:w-auto shrink-0"
        >
          {status === "generating" ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {status === "generating"
            ? "Analyzing…"
            : insights.length > 0
            ? "Re-run Analysis"
            : "Generate Insights"}
        </button>
      </div>

      {/* Generating state */}
      {status === "generating" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2">
          <RefreshCw className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-amber-900">{rotatingMessage}</p>
          <p className="text-xs text-amber-700">
            Takes {ESTIMATED_DURATION.insights}. You can navigate away — we&apos;ll finish in the background.
          </p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 leading-relaxed whitespace-pre-line">{errorMsg}</p>
        </div>
      )}

      {/* Empty-run banner — fires when the last Generate Insights call finished
          successfully but Claude found zero validated cross-competitor
          patterns. Distinct from "no insights ever generated" — it tells the
          user the engine ran and the niche/competitor set is the bottleneck,
          not the engine. */}
      {lastRunEmpty && status !== "generating" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 leading-relaxed">
            <p className="font-semibold">We analyzed {competitorCount} competitor{competitorCount === 1 ? "" : "s"} and found no patterns in 2+ of them this run.</p>
            <p className="text-amber-800 mt-1">
              Your niche may need {competitorCount < 5 ? "more competitors (5–7 is the sweet spot)" : "broader competitor coverage — try adding creators in adjacent sub-niches"}. Trends need to repeat across multiple accounts to count as validated.
            </p>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {insights.length > 0 && status !== "generating" && (
        <div className="rounded-xl border border-slate-200/60 backdrop-blur-sm bg-white/80 px-5 py-3 grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {insights.length}
            </span>
            <span className="text-xs text-slate-500 leading-tight">
              trends
              <br />
              detected
            </span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-amber-600 tabular-nums">
              {megaTips.length}
            </span>
            <span className="text-xs text-slate-500 leading-tight">
              to try
              <br />
              next
            </span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-emerald-600 tabular-nums">
              {insights.filter((i) => i.is_mega_tip === false).length}
            </span>
            <span className="text-xs text-slate-500 leading-tight">
              already
              <br />
              doing
            </span>
          </div>
        </div>
      )}

      {/* Mega tips section */}
      {megaTips.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-amber-500 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide shrink-0">
              Try these next
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" aria-hidden />
          </div>
          <div className="grid gap-3">
            {megaTips.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                fallbackTotalCompetitors={competitorCount}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other trends section */}
      {otherInsights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
              You&apos;re already doing
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" aria-hidden />
          </div>
          <div className="grid gap-3">
            {otherInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                fallbackTotalCompetitors={competitorCount}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sparse-insights nudge — shown when the user has insights but the
          engine is visibly light on data (few competitors or few trends).
          The /insights page is only meaningful when enough competitors are
          tracked; this card tells the user why the list is short. */}
      {insights.length > 0 && (competitorCount < 5 || insights.length <= 3) && (
        <Link
          href="/competitors"
          className="group block rounded-xl border border-slate-200/60 bg-gradient-to-br from-purple-50/70 to-white p-5 shadow-sm hover:shadow-md hover:border-purple-200 transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                Want richer insights?
                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {competitorCount < 5 ? (
                  <>
                    Trend detection works best with <span className="font-semibold">5–7 competitors</span>. You&apos;re tracking {competitorCount}. Adding more creators in your niche unlocks deeper, higher-confidence patterns.
                  </>
                ) : (
                  <>
                    Only {insights.length} trend{insights.length === 1 ? "" : "s"} met the threshold this run. Broader niche coverage — competitors in adjacent sub-niches — typically surfaces more patterns.
                  </>
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 font-medium">
                Currently tracking {competitorCount} competitor{competitorCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Empty state */}
      {insights.length === 0 && status === "idle" && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">No insights generated yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Click &ldquo;Generate Insights&rdquo; to run the cross-competitor analysis and
              discover what content to create.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Generate Insights
          </button>
        </div>
      )}
    </div>
  )
}
