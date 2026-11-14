"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Grid3X3,
  Settings,
  MessageSquareReply,
  ExternalLink,
  MousePointerClick,
  Zap,
} from "lucide-react"
import { InstagramIcon } from "@/components/instagram-icon"
import { InstagramAccountAvatar } from "@/components/instagram-account-avatar"
import { DmPhonePreview, type PreviewMode } from "@/components/dm-phone-preview"
import type { ConnectedInstagramAccount } from "@/lib/meta/accounts"
import type { BetaRequest } from "@/lib/beta"
import {
  MAX_REPLY_VARIANTS,
  joinReplyVariants,
  parseReplyVariants,
} from "@/lib/meta/reply-variants"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics"
import { DmTemplatePicker } from "@/components/dm-template-picker"
import type { TemplateDraft } from "@/lib/dm-templates"

export type DmAccount = ConnectedInstagramAccount

export interface DmAutomation {
  id: string
  name: string
  post_id: string | null
  post_url: string | null
  match_any_post: boolean
  keywords: string[]
  whole_word_match: boolean
  dm_message: string
  public_reply_enabled: boolean
  public_reply_message: string | null
  is_active: boolean
  // Missing until schema/024 has run.
  track_clicks?: boolean
  // Missing until schema/025 has run (then everything is "comment").
  trigger_type?: TriggerType
  created_at: string
}

export type TriggerType = "comment" | "dm" | "story_reply"

const TRIGGERS: { value: TriggerType; label: string; hint: string }[] = [
  { value: "comment", label: "Comment", hint: "On a post or reel" },
  { value: "dm", label: "DM", hint: "A message to you" },
  { value: "story_reply", label: "Story reply", hint: "A reply to your story" },
]

// "Comments on any post containing", shown on each automation row.
function triggerSummary(automation: DmAutomation): string {
  switch (automation.trigger_type ?? "comment") {
    case "dm":
      return "DMs containing"
    case "story_reply":
      return "Story replies containing"
    default:
      return `Comments on ${automation.match_any_post ? "any post" : "a post"} containing`
  }
}

export interface AutomationSendStats {
  sent: number
  pending: number
  failed: number
}

// Rows of recent activity shown per "page".
const ACTIVITY_PAGE = 8

/** Per-automation link click numbers (only DMs sent with tracking count). */
export interface ClickStats {
  byAutomation: Record<string, { trackedDms: number; clickedDms: number; clicks: number }>
  clickedLogIds: string[]
  totalClickedDms: number
}

export interface DmLogRow {
  id: string
  automation_id: string
  commenter_name: string | null
  commenter_id: string
  comment_text: string
  matched_keyword: string | null
  status: "pending" | "processing" | "sent" | "failed"
  error_message: string | null
  dm_sent_at: string | null
  public_reply_sent_at: string | null
  created_at: string
}

interface InstagramPost {
  id: string
  caption: string
  media_type: string
  thumbnail_url: string | null
  permalink: string | null
  timestamp: string
  like_count: number
  comments_count: number
}

interface FormState {
  trigger: TriggerType
  name: string
  matchAnyPost: boolean
  postId: string | null
  postUrl: string | null
  keywords: string[]
  wholeWordMatch: boolean
  dmMessage: string
  publicReplyEnabled: boolean
  // Reply variations; one is picked at random per comment.
  publicReplyMessages: string[]
  trackClicks: boolean
}

const EMPTY_FORM: FormState = {
  trigger: "comment",
  name: "",
  matchAnyPost: false,
  postId: null,
  postUrl: null,
  keywords: [],
  wholeWordMatch: true,
  dmMessage: "",
  publicReplyEnabled: false,
  publicReplyMessages: [""],
  // On for new automations; existing ones keep whatever they had.
  trackClicks: true,
}

export function DmsClient({
  account,
  initialAutomations,
  initialLogs,
  statsByAutomation,
  clickStats,
  beta,
}: {
  beta: BetaRequest
  account: DmAccount | null
  initialAutomations: DmAutomation[]
  initialLogs: DmLogRow[]
  statsByAutomation: Record<string, AutomationSendStats>
  clickStats: ClickStats
}) {
  const clickedLogs = useMemo(() => new Set(clickStats.clickedLogIds), [clickStats.clickedLogIds])
  // Activity list: "all" or one automation's id, shown a page at a time.
  const [activityFilter, setActivityFilter] = useState<string>("all")
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE)
  const filteredLogs = useMemo(
    () =>
      activityFilter === "all"
        ? initialLogs
        : initialLogs.filter((log) => log.automation_id === activityFilter),
    [initialLogs, activityFilter]
  )

  // Clicking an automation row toggles the activity filter to it.
  function showActivityFor(automationId: string) {
    const next = activityFilter === automationId ? "all" : automationId
    setActivityFilter(next)
    setActivityLimit(ACTIVITY_PAGE)
    if (next !== "all") document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" })
  }
  const router = useRouter()
  const [automations, setAutomations] = useState(initialAutomations)
  const [showForm, setShowForm] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [editing, setEditing] = useState<DmAutomation | null>(null)
  // Prefill from a template for a new automation; null = blank form.
  const [draft, setDraft] = useState<TemplateDraft | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const automationNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of automations) map.set(a.id, a.name)
    return map
  }, [automations])

  if (!account) {
    return <NotConnectedState beta={beta} />
  }

  function openNew(fromDraft: TemplateDraft | null) {
    setEditing(null)
    setDraft(fromDraft)
    setShowPicker(false)
    setShowForm(true)
    if (fromDraft) trackEvent("dm_template_picked", { template: fromDraft.templateId })
  }

  async function toggleActive(automation: DmAutomation) {
    setBusyId(automation.id)
    setError(null)
    try {
      const res = await fetch(`/api/dms/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !automation.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to update")
      setAutomations((prev) =>
        prev.map((a) => (a.id === automation.id ? data.automation : a))
      )
      trackEvent("dm_automation_toggled", { active: !automation.is_active })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setBusyId(null)
    }
  }

  async function deleteAutomation(automation: DmAutomation) {
    if (
      !window.confirm(
        `Delete "${automation.name}"? Its send history will be removed too.`
      )
    ) {
      return
    }
    setBusyId(automation.id)
    setError(null)
    try {
      const res = await fetch(`/api/dms/automations/${automation.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete")
      setAutomations((prev) => prev.filter((a) => a.id !== automation.id))
      trackEvent("dm_automation_deleted")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              DM Automation
            </h1>
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Beta
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Someone comments a keyword on your post — they get your DM seconds
            later.
          </p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New automation
        </button>
      </div>

      {/* Connected account */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <InstagramAccountAvatar
          username={account.username}
          src={account.profile_picture_url}
          className="h-14 w-14"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Connected account
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2">
            {account.name && (
              <span className="text-base font-semibold text-slate-900 truncate">
                {account.name}
              </span>
            )}
            <a
              href={`https://www.instagram.com/${account.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-purple-600 hover:underline"
            >
              @{account.username}
            </a>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {account.followers_count !== null && (
              <span>
                <span className="font-semibold text-slate-700 tabular-nums">
                  {account.followers_count.toLocaleString()}
                </span>{" "}
                followers
              </span>
            )}
            {account.token_error ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Needs reconnect
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Active{account.webhook_subscribed ? " · listening for comments" : ""}
              </span>
            )}
          </div>
        </div>
        <a
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Manage
        </a>
      </div>

      {/* Token error banner */}
      {account.token_error && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-900">
              Instagram connection needs attention
            </p>
            <p className="text-amber-800/80 text-xs mt-1">
              Your access token stopped working (this happens after a password
              change or 60 days of inactivity). Automations are paused until
              you reconnect.
            </p>
          </div>
          <a
            href="/api/instagram/connect"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Reconnect
          </a>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Automations: one row each, with its own numbers (like ManyChat) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Automations{" "}
          <span className="text-slate-400 font-normal">
            ({automations.length})
          </span>
        </h2>

        {automations.length === 0 && (
          // First automation: lead with templates so new creators don't
          // stall on a blank form.
          <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/60 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <p className="text-sm font-semibold text-slate-900">Create your first automation in a minute</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Pick what you want to send. People comment a keyword on your post and get your DM seconds later.
            </p>
            <div className="mt-4">
              <DmTemplatePicker variant="inline" onPick={openNew} onScratch={() => openNew(null)} />
            </div>
          </div>
        )}

        {automations.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
            {/* Column headers (desktop) */}
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_64px_64px_64px_96px_112px] items-center gap-4 border-b border-slate-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Name</span>
              <span className="text-right">DMs</span>
              <span className="text-right" title="People who opened the link in your DM">Clicks</span>
              <span className="text-right" title="Clicks ÷ DMs sent with click tracking on">CTR</span>
              <span className="text-right">Created</span>
              <span />
            </div>

            {automations.map((automation) => {
              const send = statsByAutomation[automation.id] ?? { sent: 0, pending: 0, failed: 0 }
              const clicks = clickStats.byAutomation[automation.id]
              const ctr = clicks && clicks.trackedDms > 0 ? Math.round((clicks.clickedDms / clicks.trackedDms) * 100) : null
              const selected = activityFilter === automation.id
              return (
                <div
                  key={automation.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_64px_64px_64px_96px_112px] items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3.5 last:border-0 transition-colors",
                    selected ? "bg-purple-50/60" : "hover:bg-slate-50/70"
                  )}
                >
                  {/* Name + trigger */}
                  <button
                    onClick={() => showActivityFor(automation.id)}
                    title="Show this automation's activity"
                    className="min-w-0 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          automation.is_active ? "bg-red-600 text-white" : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {automation.is_active ? "Live" : "Paused"}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-900">{automation.name}</span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                      <InstagramIcon className="h-3.5 w-3.5 shrink-0" />
                      {triggerSummary(automation)}
                      {automation.keywords.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="rounded-md border border-purple-200/60 bg-purple-50 px-1.5 py-px font-medium text-purple-700"
                        >
                          {kw}
                        </span>
                      ))}
                      {automation.keywords.length > 3 && <span>+{automation.keywords.length - 3}</span>}
                    </span>
                    {(send.failed > 0 || send.pending > 0) && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {send.failed > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                            <XCircle className="h-3 w-3" /> {send.failed} failed
                          </span>
                        )}
                        {send.pending > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            <Clock className="h-3 w-3" /> {send.pending} queued
                          </span>
                        )}
                      </span>
                    )}
                  </button>

                  {/* Numbers: columns on desktop, a compact line on mobile */}
                  <span className="hidden md:block text-right text-sm font-semibold tabular-nums text-slate-900">{send.sent}</span>
                  <span className="hidden md:block text-right text-sm tabular-nums text-slate-700">
                    {clicks ? clicks.clickedDms : "—"}
                  </span>
                  <span
                    className={cn("hidden md:block text-right text-sm font-semibold tabular-nums", ctr === null ? "text-slate-300" : "text-emerald-700")}
                    title={ctr === null ? (automation.track_clicks ? "Shows after the first tracked DMs go out" : "Turn on click tracking to see this") : undefined}
                  >
                    {ctr === null ? "—" : `${ctr}%`}
                  </span>
                  <span className="hidden md:block text-right text-xs text-slate-400">{formatRelative(automation.created_at)}</span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleActive(automation)}
                      disabled={busyId === automation.id}
                      title={automation.is_active ? "Pause" : "Activate"}
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                        automation.is_active ? "bg-purple-600" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          automation.is_active && "translate-x-4"
                        )}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setEditing(automation)
                        setDraft(null)
                        setShowForm(true)
                      }}
                      title="Edit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteAutomation(automation)}
                      disabled={busyId === automation.id}
                      title="Delete"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <span className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 md:hidden">
                    <span><span className="font-semibold text-slate-900 tabular-nums">{send.sent}</span> DMs</span>
                    <span><span className="font-semibold text-slate-900 tabular-nums">{clicks ? clicks.clickedDms : "—"}</span> clicks</span>
                    <span><span className="font-semibold text-emerald-700 tabular-nums">{ctr === null ? "—" : `${ctr}%`}</span> CTR</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent activity: a few rows at a time, filterable per automation */}
      <section id="activity" className="space-y-3 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
          <div className="flex items-center gap-2">
            <select
              value={activityFilter}
              onChange={(e) => {
                setActivityFilter(e.target.value)
                setActivityLimit(ACTIVITY_PAGE)
              }}
              className="h-8 max-w-[200px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="all">All automations</option>
              {automations.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 bg-white p-6 text-center">
            <p className="text-xs text-slate-500">
              {activityFilter === "all"
                ? "No activity yet. When someone comments a trigger keyword, the send shows up here."
                : "No activity for this automation yet."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5 font-semibold">Commenter</th>
                  <th className="px-4 py-2.5 font-semibold">Comment</th>
                  {activityFilter === "all" && <th className="px-4 py-2.5 font-semibold">Automation</th>}
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, activityLimit).map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                      {log.commenter_name ? (
                        <a
                          href={`https://www.instagram.com/${log.commenter_name}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-purple-600 hover:underline"
                        >
                          @{log.commenter_name}
                        </a>
                      ) : (
                        log.commenter_id
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px]">
                      <span className="line-clamp-1" title={log.comment_text}>
                        {log.comment_text || "—"}
                      </span>
                    </td>
                    {activityFilter === "all" && (
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                        {automationNames.get(log.automation_id) ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <StatusChip status={log.status} error={log.error_message} />
                      {log.public_reply_sent_at && (
                        <span
                          title="Public reply posted"
                          className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700"
                        >
                          <MessageSquareReply className="h-3 w-3" />
                          Replied
                        </span>
                      )}
                      {clickedLogs.has(log.id) && (
                        <span
                          title="Opened the link in your DM"
                          className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                        >
                          <MousePointerClick className="h-3 w-3" />
                          Clicked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                      {formatRelative(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              <span>
                Showing {Math.min(activityLimit, filteredLogs.length)} of {filteredLogs.length}
              </span>
              <span className="flex gap-3">
                {activityLimit > ACTIVITY_PAGE && (
                  <button onClick={() => setActivityLimit(ACTIVITY_PAGE)} className="font-medium hover:text-slate-800">
                    Show less
                  </button>
                )}
                {activityLimit < filteredLogs.length && (
                  <button
                    onClick={() => setActivityLimit((n) => n + ACTIVITY_PAGE)}
                    className="font-semibold text-purple-600 hover:text-purple-800"
                  >
                    Show more
                  </button>
                )}
              </span>
            </div>
          </div>
        )}
      </section>

      {showPicker && (
        <DmTemplatePicker
          variant="modal"
          onPick={openNew}
          onScratch={() => openNew(null)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showForm && (
        <AutomationForm
          key={editing?.id ?? draft?.templateId ?? "new"}
          account={account}
          editing={editing}
          draft={draft}
          onClose={() => setShowForm(false)}
          onSaved={(saved, isNew) => {
            setAutomations((prev) =>
              isNew ? [saved, ...prev] : prev.map((a) => (a.id === saved.id ? saved : a))
            )
            setShowForm(false)
            trackEvent(
              isNew ? "dm_automation_created" : "dm_automation_updated",
              isNew ? { template: draft?.templateId ?? "scratch" } : undefined
            )
          }}
        />
      )}
    </div>
  )
}

// Before Meta grants Advanced Access only Instagram Testers can connect, so
// the screen depends on the user's beta status: request access → waiting →
// approved (accept the tester invite, then connect).
function NotConnectedState({ beta }: { beta: BetaRequest }) {
  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          DM Automation
        </h1>
        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Beta
        </span>
      </div>
      <p className="text-slate-500 text-base mt-1">
        Turn comments into conversations, automatically
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200/60 bg-white p-6 sm:p-8 shadow-sm">
        {beta.status === "approved" ? (
          <ApprovedConnect />
        ) : beta.status === "pending" ? (
          <BetaPending username={beta.instagram_username} />
        ) : (
          <BetaRequestForm />
        )}
      </div>
    </div>
  )
}

function ConnectIntro() {
  return (
    <>
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm">
        <InstagramIcon className="h-7 w-7 text-white" />
      </div>
      <p className="mt-5 text-base text-slate-600 leading-relaxed">
        When someone comments a keyword like{" "}
        <span className="font-semibold text-slate-900">&ldquo;LINK&rdquo;</span> or{" "}
        <span className="font-semibold text-slate-900">&ldquo;PRICE&rdquo;</span> on
        your post, they automatically get your DM within seconds. Official
        Instagram API: no password sharing.
      </p>
    </>
  )
}

function BetaRequestForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [isProfessional, setIsProfessional] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isProfessional) {
      return setError(
        "Your account needs to be Business or Creator. Switch it in Instagram first (it's free), then tick the box."
      )
    }
    setSending(true)
    try {
      const res = await fetch("/api/beta/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram_username: username, is_professional: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your username")
      trackEvent("beta_access_requested")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your username")
      setSending(false)
    }
  }

  return (
    <>
      <ConnectIntro />
      <h2 className="mt-6 text-xl font-bold text-slate-900">
        Confirm your Instagram account
      </h2>
      <p className="mt-1.5 text-base text-slate-600 leading-relaxed">
        Tell us which Instagram account you&rsquo;ll use. If you&rsquo;re
        already on the beta list, the Connect button appears right away.
        Otherwise we&rsquo;ll activate you within a few hours and let you know
        in a DM.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="ig-username" className="text-sm font-medium text-slate-700">
            Your Instagram username
          </label>
          <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20">
            <span className="pl-4 text-base text-slate-400">@</span>
            <input
              id="ig-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourbrand"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              className="h-12 w-full rounded-xl bg-transparent px-1.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isProfessional}
            onChange={(e) => setIsProfessional(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500/30"
          />
          <span className="text-base text-slate-700">
            My account is <strong>Business</strong> or <strong>Creator</strong>
            <span className="block text-sm text-slate-500">
              Not sure? In Instagram: Settings → Account type and tools. Switching
              is free.
            </span>
          </span>
        </label>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !username.trim()}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-base font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors disabled:opacity-50 sm:w-auto"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue
        </button>
      </form>
    </>
  )
}

function BetaPending({ username }: { username: string | null }) {
  return (
    <>
      <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center">
        <Clock className="h-7 w-7 text-amber-600" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-900">Request received ✅</h2>
      <p className="mt-2 text-base text-slate-600 leading-relaxed">
        We&rsquo;re activating{" "}
        <span className="font-semibold text-slate-900">@{username ?? "your account"}</span>{" "}
        for the beta. You&rsquo;ll get a DM from us on Instagram within a few
        hours with the next step. This page will then show the{" "}
        <strong>Connect Instagram</strong> button.
      </p>
      <p className="mt-4 text-sm text-slate-500">
        Wrong username? <RequestAgainLink />
      </p>
    </>
  )
}

// Lets a waiting user fix their handle by showing the form again.
function RequestAgainLink() {
  const [open, setOpen] = useState(false)
  if (open) {
    return (
      <span className="mt-4 block border-t border-slate-100 pt-4">
        <BetaRequestFormInline />
      </span>
    )
  }
  return (
    <button onClick={() => setOpen(true)} className="font-semibold text-purple-600 hover:underline">
      Change it
    </button>
  )
}

function BetaRequestFormInline() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    const res = await fetch("/api/beta/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagram_username: username, is_professional: true }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Couldn't save")
      setSending(false)
      return
    }
    router.refresh()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="@yourbrand"
        autoCapitalize="none"
        className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-base focus:outline-none focus:border-purple-500"
      />
      <button
        disabled={sending || !username.trim()}
        className="h-11 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        Save
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  )
}

function ApprovedConnect() {
  return (
    <>
      <ConnectIntro />
      <h2 className="mt-6 text-xl font-bold text-slate-900">
        You&rsquo;re in the beta 🎉 Two steps left
      </h2>
      <ol className="mt-4 space-y-4">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
            1
          </span>
          <div className="text-base text-slate-700 leading-relaxed">
            <strong>Accept the tester invite</strong> on Instagram&rsquo;s website
            (it doesn&rsquo;t show in the app): Settings → Apps and websites →{" "}
            <em>Tester invites</em> → Accept.
            <a
              href="https://www.instagram.com/accounts/manage_access/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Open tester invites
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
            2
          </span>
          <div className="text-base text-slate-700 leading-relaxed">
            <strong>Connect your account</strong>
            <a
              href="/api/instagram/connect"
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-base font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors sm:w-fit"
            >
              <InstagramIcon className="h-5 w-5" />
              Connect Instagram
            </a>
          </div>
        </li>
      </ol>
      <p className="mt-5 text-sm text-slate-500">
        Requires an Instagram <strong>Business or Creator</strong> account.
      </p>
    </>
  )
}

function AutomationForm({
  account,
  editing,
  draft,
  onClose,
  onSaved,
}: {
  account: DmAccount
  editing: DmAutomation | null
  draft: TemplateDraft | null
  onClose: () => void
  onSaved: (automation: DmAutomation, isNew: boolean) => void
}) {
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          trigger: editing.trigger_type ?? "comment",
          name: editing.name,
          matchAnyPost: editing.match_any_post,
          postId: editing.post_id,
          postUrl: editing.post_url,
          keywords: editing.keywords,
          wholeWordMatch: editing.whole_word_match,
          dmMessage: editing.dm_message,
          publicReplyEnabled: editing.public_reply_enabled,
          publicReplyMessages: parseReplyVariants(editing.public_reply_message).length
            ? parseReplyVariants(editing.public_reply_message)
            : [""],
          trackClicks: Boolean(editing.track_clicks),
        }
      : draft
        ? {
            ...EMPTY_FORM,
            name: draft.name,
            keywords: draft.keywords,
            dmMessage: draft.dmMessage,
            publicReplyEnabled: draft.publicReplyEnabled,
            publicReplyMessages: draft.publicReplyMessages,
          }
        : EMPTY_FORM
  )
  const [keywordInput, setKeywordInput] = useState("")
  const [posts, setPosts] = useState<InstagramPost[] | null>(null)
  const [postsError, setPostsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<PreviewMode>("comment")
  const isComment = form.trigger === "comment"
  // Step numbers shift: DM and story automations skip "post" and "public reply".
  const stepKeywords = isComment ? 3 : 2
  const [previewReplyIndex, setPreviewReplyIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch("/api/instagram/posts")
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Failed to load posts")
        if (!cancelled) setPosts(data.posts)
      })
      .catch((e) => {
        if (!cancelled) {
          setPosts([])
          setPostsError(e instanceof Error ? e.message : "Failed to load posts")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Escape closes the editor, like the backdrop click.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // The preview shows the picked post, or the latest one for "any post".
  const previewPost =
    posts?.find((p) => p.id === form.postId) ??
    (form.matchAnyPost ? posts?.[0] : undefined)
  const previewKeyword =
    form.keywords[0] ?? (keywordInput.trim() || "LINK")

  function addKeyword(raw: string) {
    const parts = raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    setForm((f) => ({
      ...f,
      keywords: Array.from(new Set([...f.keywords, ...parts])).slice(0, 20),
    }))
    setKeywordInput("")
  }

  async function save() {
    setFormError(null)
    const pendingKeyword = keywordInput.trim()
    const keywords = pendingKeyword
      ? Array.from(new Set([...form.keywords, pendingKeyword]))
      : form.keywords

    if (!form.name.trim()) return setFormError("Give the automation a name.")
    if (keywords.length === 0)
      return setFormError("Add at least one trigger keyword.")
    if (isComment && !form.matchAnyPost && !form.postId)
      return setFormError("Pick a post, or switch to “Any post”.")
    if (!form.dmMessage.trim()) return setFormError("Write the DM message.")
    const publicReplies = joinReplyVariants(form.publicReplyMessages)
    if (isComment && form.publicReplyEnabled && !publicReplies)
      return setFormError("Write the public reply, or turn it off.")

    setSaving(true)
    try {
      // DM and story-reply automations have no post and no public reply.
      const payload = {
        trigger_type: form.trigger,
        name: form.name,
        match_any_post: isComment && form.matchAnyPost,
        post_id: isComment && !form.matchAnyPost ? form.postId : null,
        post_url: isComment && !form.matchAnyPost ? form.postUrl : null,
        keywords,
        whole_word_match: form.wholeWordMatch,
        dm_message: form.dmMessage,
        public_reply_enabled: isComment && form.publicReplyEnabled,
        public_reply_message: isComment && form.publicReplyEnabled
          ? publicReplies
          : null,
        track_clicks: form.trackClicks,
      }
      const res = await fetch(
        editing ? `/api/dms/automations/${editing.id}` : "/api/dms/automations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save")
      onSaved(data.automation, !editing)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/40 backdrop-blur-sm sm:p-4">
      <div className="flex w-full flex-col overflow-hidden bg-white shadow-xl sm:rounded-2xl">
        {/* Top bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
          <button
            onClick={onClose}
            title="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={editing ? "Automation name" : "Name your automation…"}
            className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="hidden sm:inline-flex rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {editing ? "Save changes" : "Go live"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto lg:flex lg:flex-row lg:overflow-hidden">
          {/* Settings */}
          <div className="lg:min-h-0 lg:w-[460px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-slate-100">
            <div className="space-y-7 px-4 py-6 sm:px-6">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}

              {/* Step 1: what starts it */}
              <Step n={1} title="What starts it">
                <div className="grid grid-cols-3 gap-2">
                  {TRIGGERS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, trigger: t.value }))
                        setPreviewMode(t.value === "comment" ? "comment" : "dm")
                      }}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-left transition-colors",
                        form.trigger === t.value
                          ? "border-purple-500 bg-purple-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    >
                      <span className={cn("block text-xs font-semibold", form.trigger === t.value ? "text-purple-700" : "text-slate-700")}>
                        {t.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-slate-500">{t.hint}</span>
                    </button>
                  ))}
                </div>
                {!isComment && (
                  <p className="text-[11px] leading-snug text-slate-500">
                    {form.trigger === "dm"
                      ? "When someone sends you a message with your keyword, they get your DM right back."
                      : "When someone replies to any of your stories with your keyword, they get your DM right back."}{" "}
                    Each person gets it at most once a day.
                  </p>
                )}
              </Step>

              {/* Step 2: post (comments only) */}
              {isComment && (
              <Step n={2} title="When someone comments on">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, matchAnyPost: false }))}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                      !form.matchAnyPost
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    )}
                  >
                    A specific post
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, matchAnyPost: true, postId: null, postUrl: null }))
                    }
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5",
                      form.matchAnyPost
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    )}
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                    Any post
                  </button>
                </div>

                {!form.matchAnyPost && (
                  <div className="mt-3">
                    {posts === null ? (
                      <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-8 text-xs text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading your posts…
                      </div>
                    ) : posts.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white py-6 px-4 text-center text-xs text-slate-500">
                        {postsError ?? "No posts found on this account."}
                      </div>
                    ) : (
                      <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-1.5 sm:max-h-60 sm:grid-cols-4">
                        {posts.map((post) => (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                postId: post.id,
                                postUrl: post.permalink,
                              }))
                              setPreviewMode("comment")
                            }}
                            title={post.caption.slice(0, 100)}
                            className={cn(
                              "relative block w-full overflow-hidden rounded-md border-2 pt-[125%] transition-all",
                              form.postId === post.id
                                ? "border-purple-600 ring-2 ring-purple-500/30"
                                : "border-transparent hover:border-slate-300"
                            )}
                          >
                            {post.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={post.thumbnail_url}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-[9px] text-slate-400 p-1 text-center">
                                {post.media_type}
                              </div>
                            )}
                            {form.postId === post.id && (
                              <span className="absolute right-1 top-1 rounded-full bg-purple-600 p-0.5">
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Step>
              )}

              {/* Keywords */}
              <Step
                n={stepKeywords}
                title={
                  form.trigger === "dm"
                    ? "And the message contains"
                    : form.trigger === "story_reply"
                      ? "And the story reply contains"
                      : "And the comment contains"
                }
              >
                <div
                  onFocus={() => setPreviewMode(isComment ? "comment" : "dm")}
                  className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all"
                >
                  {form.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200/60 px-2 py-1 text-xs font-medium text-purple-700"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            keywords: f.keywords.filter((k) => k !== kw),
                          }))
                        }
                        className="text-purple-400 hover:text-purple-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        addKeyword(keywordInput)
                      } else if (
                        e.key === "Backspace" &&
                        !keywordInput &&
                        form.keywords.length > 0
                      ) {
                        setForm((f) => ({ ...f, keywords: f.keywords.slice(0, -1) }))
                      }
                    }}
                    onBlur={() => addKeyword(keywordInput)}
                    placeholder={form.keywords.length === 0 ? "LINK, GUIDE, PRICE…" : ""}
                    className="flex-1 min-w-[100px] border-0 bg-transparent text-sm focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Press Enter or comma to add. Any of these words triggers the DM.
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.wholeWordMatch}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, wholeWordMatch: e.target.checked }))
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500/30"
                  />
                  Match whole words only (&ldquo;link&rdquo; won&rsquo;t match
                  &ldquo;linking&rdquo;)
                </label>
              </Step>

              {/* DM */}
              <Step n={stepKeywords + 1} title="They will get a DM">
                <textarea
                  value={form.dmMessage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dmMessage: e.target.value }))
                  }
                  onFocus={() => setPreviewMode("dm")}
                  rows={5}
                  maxLength={1000}
                  placeholder={"Hey! Here's the link you asked for: https://…"}
                  className={cn(inputCls, "py-2 resize-y")}
                />
                <p className="text-[11px] text-slate-400 text-right">
                  {form.dmMessage.length}/1000
                </p>
                <label className="flex items-start justify-between gap-3 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <MousePointerClick className="h-3.5 w-3.5 text-purple-600" />
                      Track link clicks
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                      Links are sent as a short link so you can see who clicked. They still open your page.
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.trackClicks}
                    onClick={() => setForm((f) => ({ ...f, trackClicks: !f.trackClicks }))}
                    className={cn(
                      "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
                      form.trackClicks ? "bg-purple-600" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        form.trackClicks && "translate-x-4"
                      )}
                    />
                  </button>
                </label>
              </Step>

              {/* Public reply (comments only) */}
              {isComment && (
              <Step n={5} title="And a public reply" optional>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-xs text-slate-600">
                    Reply under their comment so others see it works
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.publicReplyEnabled}
                    onClick={() => {
                      setForm((f) => ({ ...f, publicReplyEnabled: !f.publicReplyEnabled }))
                      setPreviewMode("comment")
                    }}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      form.publicReplyEnabled ? "bg-purple-600" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        form.publicReplyEnabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </label>
                {form.publicReplyEnabled && (
                  <div className="mt-3 space-y-2">
                    {form.publicReplyMessages.map((reply, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={reply}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              publicReplyMessages: f.publicReplyMessages.map((r, j) =>
                                j === i ? e.target.value : r
                              ),
                            }))
                          }
                          onFocus={() => {
                            setPreviewMode("comment")
                            setPreviewReplyIndex(i)
                          }}
                          placeholder={REPLY_PLACEHOLDERS[i] ?? "Another variation…"}
                          className={cn(inputCls, "h-10")}
                        />
                        {form.publicReplyMessages.length > 1 && (
                          <button
                            type="button"
                            title="Remove this variation"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                publicReplyMessages: f.publicReplyMessages.filter((_, j) => j !== i),
                              }))
                              setPreviewReplyIndex(0)
                            }}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {form.publicReplyMessages.length < MAX_REPLY_VARIANTS && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            publicReplyMessages: [...f.publicReplyMessages, ""],
                          }))
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add a variation
                      </button>
                    )}
                    <p className="text-[11px] text-slate-400">
                      Each comment gets one of these at random, so replies under
                      your post don&rsquo;t all look the same.
                    </p>
                  </div>
                )}
              </Step>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center bg-slate-50 px-4 py-6 lg:min-h-0 lg:flex-1 lg:justify-center lg:overflow-y-auto">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Live preview
            </p>
            <DmPhonePreview
              mode={previewMode}
              onModeChange={setPreviewMode}
              username={account.username}
              avatarUrl={account.profile_picture_url}
              postThumbnail={previewPost?.thumbnail_url ?? null}
              keyword={previewKeyword}
              dmMessage={form.dmMessage}
              publicReplyEnabled={form.publicReplyEnabled}
              publicReplyMessage={
                form.publicReplyMessages[previewReplyIndex] ??
                form.publicReplyMessages[0] ??
                ""
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const REPLY_PLACEHOLDERS = [
  "Sent you a DM! 📩",
  "Check your inbox 😉",
  "Done, it's in your DMs! 🚀",
]

function Step({
  n,
  title,
  optional,
  children,
}: {
  n: number
  title: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
          {n}
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {optional && (
          <span className="text-[11px] font-medium text-slate-400">optional</span>
        )}
      </div>
      <div className="rounded-xl bg-slate-50 p-3">{children}</div>
    </section>
  )
}

function StatusChip({
  status,
  error,
}: {
  status: DmLogRow["status"]
  error: string | null
}) {
  const config = {
    sent: { label: "Sent", cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
    pending: { label: "Queued", cls: "bg-slate-100 text-slate-600", Icon: Clock },
    processing: { label: "Sending", cls: "bg-blue-100 text-blue-700", Icon: Loader2 },
    failed: { label: "Failed", cls: "bg-red-100 text-red-700", Icon: XCircle },
  }[status]

  return (
    <span
      title={status === "failed" && error ? error : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        config.cls
      )}
    >
      <config.Icon
        className={cn("h-3 w-3", status === "processing" && "animate-spin")}
      />
      {config.label}
    </span>
  )
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
