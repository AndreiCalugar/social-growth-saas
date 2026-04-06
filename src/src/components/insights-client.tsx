"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, TrendingUp, Users, CheckCircle, XCircle, Zap } from "lucide-react"

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

  // confidence is stored as a ratio (e.g. 0.67 = 2/3)
  // We display the raw confidence_label from the workflow but we only have confidence ratio here
  // Format as percentage or multiplier
  const confidencePct = insight.confidence != null ? Math.round(insight.confidence * 100) : null

  return (
    <Card className={`relative overflow-hidden ${isMegaTip ? "border-orange-300 bg-orange-50/30" : ""}`}>
      {isMegaTip && (
        <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl">
          MEGA TIP
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold leading-snug pr-12">
            {insight.trend_name}
          </CardTitle>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {confidencePct != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 font-medium">
              <Users className="h-3 w-3" />
              {confidencePct}% of competitors
            </span>
          )}
          {multiplier > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] text-green-700 font-medium">
              <TrendingUp className="h-3 w-3" />
              {multiplier.toFixed(1)}x avg engagement
            </span>
          )}
          {insight.is_mega_tip === false ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] text-green-700 font-medium">
              <CheckCircle className="h-3 w-3" />
              You&apos;re already doing this
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-600 font-medium">
              <XCircle className="h-3 w-3" />
              You&apos;re not doing this yet
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Multiplier highlight */}
        {multiplier > 0 && (
          <div className="text-4xl font-bold text-foreground tabular-nums">
            {multiplier.toFixed(1)}
            <span className="text-lg font-normal text-muted-foreground ml-1">× avg engagement</span>
          </div>
        )}

        {/* Example posts */}
        {examples.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Top examples
            </p>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {examples.map((ex, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                        {ex.competitor}
                      </td>
                      <td className="px-3 py-2 max-w-[220px] truncate text-muted-foreground">
                        {ex.caption_preview}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{fmt(ex.likes)} ♥</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmt(ex.comments)} 💬</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mega-tip recommendation */}
        {insight.recommendation && (
          <div className={`rounded-md p-4 space-y-1 ${isMegaTip ? "bg-orange-100 border border-orange-200" : "bg-muted/50 border"}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wide ${isMegaTip ? "text-orange-700" : "text-muted-foreground"}`}>
              <Zap className="inline h-3 w-3 mr-1" />
              {isMegaTip ? "Mega Tip — do this now" : "Recommendation"}
            </p>
            <p className="text-sm leading-relaxed">{insight.recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function InsightsClient({ ownProfileId, initialInsights, competitorCount }: Props) {
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
      const text = await res.text()
      console.log("[pollForInsights] raw response:", text.slice(0, 200))
      const json = JSON.parse(text)
      if (json.error) console.warn("[pollForInsights] API error:", json.error)
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
      console.log("[handleGenerate] calling n8n webhook with profile_id:", ownProfileId)
      const res = await fetch("http://localhost:5678/webhook/cross-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ own_profile_id: ownProfileId }),
      })

      const rawText = await res.text()
      console.log("[handleGenerate] n8n response status:", res.status, "body:", rawText.slice(0, 500))

      if (!res.ok) {
        throw new Error(`n8n webhook failed (${res.status}): ${rawText.slice(0, 300)}`)
      }

      // Safe JSON parse — n8n returns empty body when workflow errors before Respond Success
      let json: Record<string, unknown> = {}
      if (rawText.trim()) {
        try {
          json = JSON.parse(rawText)
        } catch {
          console.warn("[handleGenerate] n8n response was not JSON:", rawText.slice(0, 200))
        }
      } else {
        // Empty body = workflow crashed before Respond Success node
        // Almost always means the trend_insights table doesn't exist yet
        console.warn("[handleGenerate] n8n returned empty body — workflow errored mid-run.")
        throw new Error(
          "⚠️ The n8n workflow crashed before finishing. The most likely cause: the trend_insights table doesn't exist in Supabase yet.\n\nFix: Go to Supabase → SQL Editor → paste and run the contents of schema/003-trend-insights.sql, then click Generate Insights again."
        )
      }

      if (json.error) {
        throw new Error(`Workflow error: ${json.error}`)
      }

      // Success — poll DB for the saved rows
      if (json.insights || json.trends_detected != null) {
        pollingRef.current = setInterval(pollForInsights, 3000)
        setTimeout(() => {
          if (pollingRef.current) clearInterval(pollingRef.current)
          if (status !== "done") {
            setStatus("error")
            setErrorMsg("Analysis completed but insights didn't load. Refresh the page.")
          }
        }, 60_000)
      } else {
        // Start polling regardless
        pollingRef.current = setInterval(pollForInsights, 5000)
      }
    } catch (e) {
      setStatus("error")
      setErrorMsg(e instanceof Error ? e.message : "Unknown error")
    }
  }

  const megaTips = insights.filter((i) => i.is_mega_tip)
  const notMegaTips = insights.filter((i) => !i.is_mega_tip)
  const doing = insights.filter((i) => i.is_mega_tip === false).length
  const total = insights.length

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            Insights Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-competitor trend detection across {competitorCount} accounts
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={status === "generating" || !ownProfileId}
          className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Sparkles className="h-4 w-4" />
          {status === "generating" ? "Analyzing…" : insights.length > 0 ? "Re-run Analysis" : "Generate Insights"}
        </button>
      </div>

      {/* Loading state */}
      {status === "generating" && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="pt-6 pb-6 text-center space-y-2">
            <div className="text-2xl animate-pulse">🔍</div>
            <p className="text-sm font-medium">Analyzing trends across your competitors…</p>
            <p className="text-xs text-muted-foreground">This takes 30–60 seconds. Claude is reading all posts.</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {status === "error" && errorMsg && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary bar */}
      {insights.length > 0 && status !== "generating" && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
          <span>
            <strong className="text-foreground">{total}</strong> trends detected in your niche
          </span>
          <span>
            <strong className="text-orange-600">{megaTips.length}</strong> mega-tips you should act on
          </span>
          <span>
            <strong className="text-green-600">{doing}</strong> of {total} you&apos;re already doing
          </span>
        </div>
      )}

      {/* Mega-tip cards */}
      {megaTips.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-600 flex items-center gap-1">
            <Zap className="h-4 w-4" />
            Mega Tips — Act on these now
          </h2>
          <div className="grid gap-4 sm:grid-cols-1">
            {megaTips.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Other detected trends */}
      {notMegaTips.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Other Detected Trends
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {notMegaTips.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {insights.length === 0 && status === "idle" && (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <div className="text-4xl">✨</div>
            <div>
              <p className="text-sm font-medium">No insights generated yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click &ldquo;Generate Insights&rdquo; to run the cross-competitor analysis.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
