"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles, TrendingUp, Users, Zap, RefreshCw, AlertCircle } from "lucide-react"

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
    if (Array.isArray(parsed)) return parsed.slice(0, 3)
  } catch {}
  return []
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function InsightCard({ insight }: { insight: Insight }) {
  const examples = parseExamples(insight.example_posts)
  const multiplier = insight.performance_multiplier ?? 0
  const isMegaTip = insight.is_mega_tip === true
  const confidencePct = insight.confidence != null ? Math.round(insight.confidence * 100) : null

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden border-l-4 ${
      isMegaTip ? "border-l-amber-500 border-slate-200" : "border-l-purple-500 border-slate-200"
    }`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-slate-900 leading-snug pr-2">
            {insight.trend_name}
          </h3>
          {isMegaTip && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
              <Zap className="h-3 w-3" /> MEGA TIP
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {confidencePct != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-medium">
              <Users className="h-3 w-3" />
              {confidencePct}% of competitors
            </span>
          )}
          {multiplier > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
              <TrendingUp className="h-3 w-3" />
              {multiplier.toFixed(1)}× avg engagement
            </span>
          )}
          {insight.is_mega_tip === false ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
              ✓ You&apos;re doing this
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-[11px] font-medium">
              ✗ You&apos;re not doing this
            </span>
          )}
        </div>

        {/* Large multiplier */}
        {multiplier > 0 && (
          <div className="mb-4">
            <span className="text-4xl font-bold text-slate-900 tabular-nums tracking-tight">
              {multiplier.toFixed(1)}
            </span>
            <span className="text-base font-normal text-slate-400 ml-1.5">× avg engagement</span>
          </div>
        )}

        {/* Example posts table */}
        {examples.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Top examples
            </p>
            <div className="rounded-lg border border-slate-100 overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {examples.map((ex, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="px-3 py-2 font-medium text-slate-600 whitespace-nowrap">
                        @{ex.competitor}
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">
                        {ex.caption_preview}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-700 text-right">
                        {fmt(ex.likes)} ♥
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {insight.recommendation && (
          <div className={`rounded-lg px-4 py-3 ${
            isMegaTip
              ? "bg-amber-50 border border-amber-100"
              : "bg-purple-50 border border-purple-100"
          }`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
              isMegaTip ? "text-amber-700" : "text-purple-700"
            }`}>
              {isMegaTip ? "⚡ Do this now" : "Recommendation"}
            </p>
            <p className={`text-sm leading-relaxed ${
              isMegaTip ? "text-amber-900" : "text-purple-900"
            }`}>
              {insight.recommendation}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function InsightsClient({ ownProfileId, userId, initialInsights, competitorCount }: Props) {
  const [insights, setInsights] = useState<Insight[]>(initialInsights)
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">(
    initialInsights.length > 0 ? "done" : "idle"
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startCountRef = useRef<number>(0)

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  async function pollForInsights() {
    if (!ownProfileId) return
    try {
      const res = await fetch(`/api/insights?profile_id=${ownProfileId}`)
      const json = await res.json()
      const fetched: Insight[] = json.insights ?? []
      if (fetched.length > startCountRef.current) {
        setInsights(fetched)
        setStatus("done")
        if (pollingRef.current) clearInterval(pollingRef.current)
      }
    } catch (e) {
      console.error("[pollForInsights] error:", e)
    }
  }

  async function handleGenerate() {
    if (!ownProfileId) {
      setErrorMsg("No own profile found. Add your own account in Profiles first.")
      setStatus("error")
      return
    }

    setStatus("generating")
    setErrorMsg(null)
    startCountRef.current = insights.length

    try {
      const res = await fetch("http://localhost:5678/webhook/cross-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ own_profile_id: ownProfileId, user_id: userId }),
      })

      const rawText = await res.text()

      if (!res.ok) {
        throw new Error(`n8n webhook failed (${res.status}): ${rawText.slice(0, 300)}`)
      }

      let json: Record<string, unknown> = {}
      if (rawText.trim()) {
        try { json = JSON.parse(rawText) } catch { /* non-JSON */ }
      } else {
        throw new Error(
          "The n8n workflow crashed before finishing. Most likely cause: the trend_insights table doesn't exist in Supabase yet.\n\nFix: Go to Supabase → SQL Editor → run schema/003-trend-insights.sql, then try again."
        )
      }

      if (json.error) throw new Error(`Workflow error: ${json.error}`)

      pollingRef.current = setInterval(pollForInsights, 3000)
      setTimeout(() => {
        if (pollingRef.current) clearInterval(pollingRef.current)
        if (status !== "done") {
          setStatus("error")
          setErrorMsg("Analysis completed but insights didn't load. Refresh the page.")
        }
      }, 60_000)
    } catch (e) {
      setStatus("error")
      setErrorMsg(e instanceof Error ? e.message : "Unknown error")
    }
  }

  const megaTips = insights.filter((i) => i.is_mega_tip)
  const otherInsights = insights.filter((i) => !i.is_mega_tip)

  return (
    <div className="p-6 space-y-6 max-w-4xl">
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
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shrink-0"
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
          <p className="text-sm font-semibold text-amber-900">Analyzing trends across your competitors…</p>
          <p className="text-xs text-amber-700">Claude is reading all posts. This takes 30–60 seconds.</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* Summary bar */}
      {insights.length > 0 && status !== "generating" && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 flex items-center gap-6 flex-wrap shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{insights.length}</span>
            <span className="text-xs text-slate-500 leading-tight">trends<br />detected</span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-amber-600 tabular-nums">{megaTips.length}</span>
            <span className="text-xs text-slate-500 leading-tight">mega-tips<br />to act on</span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-emerald-600 tabular-nums">
              {insights.filter((i) => i.is_mega_tip === false).length}
            </span>
            <span className="text-xs text-slate-500 leading-tight">already<br />doing</span>
          </div>
        </div>
      )}

      {/* Mega tips section */}
      {megaTips.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Mega Tips — Act on these now
            </h2>
          </div>
          <div className="grid gap-4">
            {megaTips.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Other trends section */}
      {otherInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Other Detected Trends
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {otherInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {insights.length === 0 && status === "idle" && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">No insights generated yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Click &ldquo;Generate Insights&rdquo; to run the cross-competitor analysis and discover
              what content to create.
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
