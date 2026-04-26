"use client"

import { useState } from "react"
import {
  Search,
  ChevronDown,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  Info,
  ExternalLink,
  AtSign,
  UserPlus,
} from "lucide-react"

export interface DiscoveryHashtag {
  tag: string
  note?: string
}
export interface DiscoveryCategory {
  name: string
  hashtags: DiscoveryHashtag[]
}
export interface DiscoverySuggestions {
  detected_niche?: string
  categories?: DiscoveryCategory[]
}

export interface MentionSuggestion {
  username: string
  mention_count: number
  competitor_count: number
}

// AddCompetitorForm listens for this event and writes the username into its
// input, then focuses it. Keeps the two components decoupled from a shared
// store while still letting the discovery section drive a prefill.
export const PREFILL_EVENT = "competitors:prefill-username"

function dispatchPrefill(username: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(PREFILL_EVENT, { detail: { username } }))
  // Bring the form into view so the prefilled value is visible — important on
  // mobile where the discovery section pushes the form off-screen.
  document.querySelector<HTMLElement>('[data-add-competitor-form]')?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  })
}

function instagramTagUrl(tag: string): string {
  return `https://www.instagram.com/explore/tags/${encodeURIComponent(tag.replace(/^#/, ""))}/`
}

export function CompetitorDiscovery({
  ownProfileId: _ownProfileId,
  ownUsername,
  hasOwnPosts,
  initialSuggestions,
  initialUpdatedAt,
  mentionSuggestions,
}: {
  ownProfileId: string
  ownUsername: string
  hasOwnPosts: boolean
  initialSuggestions: DiscoverySuggestions | null
  initialUpdatedAt: string | null
  mentionSuggestions: MentionSuggestion[]
}) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<DiscoverySuggestions | null>(initialSuggestions)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/discover-hashtags", { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.discovery_hashtags) {
        throw new Error(json.error ?? `Generation failed (${res.status})`)
      }
      setSuggestions(json.discovery_hashtags)
      setUpdatedAt(json.discovery_hashtags_updated ?? new Date().toISOString())
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setLoading(false)
    }
  }

  const showMentions = mentionSuggestions.length > 0

  return (
    <section className="rounded-xl border border-purple-200/60 bg-purple-50/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2.5">
          <span className="h-7 w-7 shrink-0 rounded-lg bg-white border border-purple-200 flex items-center justify-center shadow-sm">
            <Search className="h-3.5 w-3.5 text-purple-600" />
          </span>
          <span className="text-sm font-semibold text-slate-900">
            Need help finding competitors?
          </span>
          {(suggestions || showMentions) && !open && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-[11px] font-medium">
              {suggestions ? "Hashtags ready" : `${mentionSuggestions.length} mentions`}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 sm:px-5 pb-5 space-y-5">
            {/* Hashtag suggestions */}
            <div>
              <HashtagSection
                ownUsername={ownUsername}
                hasOwnPosts={hasOwnPosts}
                suggestions={suggestions}
                loading={loading}
                errorMsg={errorMsg}
                updatedAt={updatedAt}
                onGenerate={generate}
              />
            </div>

            {/* @-mention suggestions — only when at least one competitor has
                been scraped enough to expose mention overlap. */}
            {showMentions && (
              <div className="pt-5 border-t border-purple-200/40">
                <MentionsSection mentions={mentionSuggestions} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function HashtagSection({
  ownUsername,
  hasOwnPosts,
  suggestions,
  loading,
  errorMsg,
  updatedAt,
  onGenerate,
}: {
  ownUsername: string
  hasOwnPosts: boolean
  suggestions: DiscoverySuggestions | null
  loading: boolean
  errorMsg: string | null
  updatedAt: string | null
  onGenerate: () => void
}) {
  if (errorMsg) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
        <div className="text-sm text-red-700">
          <p>{errorMsg}</p>
          <button
            onClick={onGenerate}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
          >
            <RefreshCw className="h-3 w-3" /> Try again
          </button>
        </div>
      </div>
    )
  }

  if (!suggestions) {
    return (
      <div className="rounded-lg border border-purple-200/60 bg-white px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-600 leading-snug">
          Analyze <span className="font-semibold">@{ownUsername}</span>&apos;s posts to suggest hashtags
          you can search on Instagram to find competitors in your niche.
        </p>
        <button
          onClick={onGenerate}
          disabled={loading || !hasOwnPosts}
          title={!hasOwnPosts ? "Scrape your own profile first" : undefined}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed shrink-0 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Analyze my profile
            </>
          )}
        </button>
      </div>
    )
  }

  const niche = suggestions.detected_niche?.trim()
  const categories = (suggestions.categories ?? []).filter(
    (c) => c && c.name && Array.isArray(c.hashtags) && c.hashtags.length > 0
  )

  return (
    <div className="space-y-3">
      {niche && (
        <p className="text-sm text-slate-700">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 mr-1">
            Detected niche:
          </span>
          {niche}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.name}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              {cat.name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cat.hashtags.map((h) => {
                const tag = h.tag.replace(/^#/, "")
                return (
                  <a
                    key={tag}
                    href={instagramTagUrl(tag)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={h.note ? `${h.note} — opens Instagram in a new tab` : "Opens Instagram in a new tab"}
                    className="group inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-3 py-1 text-sm hover:bg-purple-50 hover:border-purple-300 cursor-pointer transition-colors"
                  >
                    <span className="text-slate-700 group-hover:text-purple-700">#{tag}</span>
                    {h.note && <Info className="h-3 w-3 text-slate-300 group-hover:text-purple-400" />}
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 leading-snug">
        Browse these hashtags on Instagram, find creators you like, then add their username above.
      </p>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-slate-400">
          {updatedAt ? `Updated ${formatRelative(updatedAt)}` : ""}
        </span>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-700 hover:text-purple-900 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh suggestions
        </button>
      </div>
    </div>
  )
}

function MentionsSection({ mentions }: { mentions: MentionSuggestion[] }) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700 inline-flex items-center gap-1.5">
          <AtSign className="h-3 w-3" />
          Accounts mentioned by your competitors
        </p>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug">
          Handles your competitors tag in their captions — usually collaborators or peers in your niche.
        </p>
      </div>
      <ul className="divide-y divide-purple-100/50 rounded-lg border border-purple-200/60 bg-white/70">
        {mentions.map((m) => (
          <li
            key={m.username}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div className="min-w-0">
              <a
                href={`https://www.instagram.com/${m.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-slate-900 hover:text-purple-700 inline-flex items-center gap-1"
              >
                @{m.username}
                <ExternalLink className="h-3 w-3 text-slate-300" />
              </a>
              <p className="text-[11px] text-slate-500">
                Mentioned {m.mention_count} time{m.mention_count === 1 ? "" : "s"} across{" "}
                {m.competitor_count} competitor{m.competitor_count === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dispatchPrefill(m.username)}
              className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-white px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors shrink-0"
            >
              <UserPlus className="h-3 w-3" />
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ""
  const mins = Math.round(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}
