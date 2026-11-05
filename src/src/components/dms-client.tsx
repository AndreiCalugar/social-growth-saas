"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  MessageCircle,
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
  Send,
  Grid3X3,
  Settings,
  MessageSquareReply,
  ExternalLink,
  Zap,
} from "lucide-react"
import { InstagramIcon } from "@/components/instagram-icon"
import { InstagramAccountAvatar } from "@/components/instagram-account-avatar"
import { DmPhonePreview, type PreviewMode } from "@/components/dm-phone-preview"
import type { ConnectedInstagramAccount } from "@/lib/meta/accounts"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics"

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
  created_at: string
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
  name: string
  matchAnyPost: boolean
  postId: string | null
  postUrl: string | null
  keywords: string[]
  wholeWordMatch: boolean
  dmMessage: string
  publicReplyEnabled: boolean
  publicReplyMessage: string
}

const EMPTY_FORM: FormState = {
  name: "",
  matchAnyPost: false,
  postId: null,
  postUrl: null,
  keywords: [],
  wholeWordMatch: true,
  dmMessage: "",
  publicReplyEnabled: false,
  publicReplyMessage: "",
}

export function DmsClient({
  account,
  initialAutomations,
  initialLogs,
  stats,
  sentByAutomation,
}: {
  account: DmAccount | null
  initialAutomations: DmAutomation[]
  initialLogs: DmLogRow[]
  stats: { sent: number; pending: number; failed: number }
  sentByAutomation: Record<string, number>
}) {
  const router = useRouter()
  const [automations, setAutomations] = useState(initialAutomations)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DmAutomation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const automationNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of automations) map.set(a.id, a.name)
    return map
  }, [automations])

  if (!account) {
    return <NotConnectedState />
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
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Send} label="DMs sent" value={stats.sent} tone="purple" />
        <StatCard icon={Clock} label="Queued" value={stats.pending} tone="slate" />
        <StatCard icon={XCircle} label="Failed" value={stats.failed} tone="red" />
      </div>

      {/* Automations */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Automations{" "}
          <span className="text-slate-400 font-normal">
            ({automations.length})
          </span>
        </h2>

        {automations.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 sm:p-8">
            <div className="text-center">
              <MessageCircle className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700 mt-3">
                No automations yet
              </p>
            </div>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Grid3X3, title: "Pick a post", text: "Choose a post or reel — or let it run on any post." },
                { icon: Zap, title: "Choose a keyword", text: "Like “LINK” — the word people comment to get your message." },
                { icon: Send, title: "Write the DM", text: "It's sent automatically, seconds after they comment." },
              ].map((step, i) => (
                <li key={step.title} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <step.icon className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-semibold text-slate-800">{step.title}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-5 text-center">
              <button
                onClick={() => {
                  setEditing(null)
                  setShowForm(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create your first automation
              </button>
            </div>
          </div>
        )}

        {automations.map((automation) => (
          <div
            key={automation.id}
            className={cn(
              "rounded-xl border bg-white p-4 shadow-sm transition-opacity",
              automation.is_active
                ? "border-slate-200/60"
                : "border-slate-200/60 opacity-60"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {automation.name}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      automation.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {automation.is_active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-purple-700">
                    <Send className="h-3.5 w-3.5" />
                    {sentByAutomation[automation.id] ?? 0} DMs sent
                  </span>
                  {automation.match_any_post ? (
                    <span className="inline-flex items-center gap-1">
                      <Grid3X3 className="h-3.5 w-3.5" />
                      Any post
                    </span>
                  ) : automation.post_url ? (
                    <a
                      href={automation.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-purple-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View post
                    </a>
                  ) : (
                    <span>Specific post</span>
                  )}
                  <span>{automation.whole_word_match ? "Whole word" : "Partial match"}</span>
                  {automation.public_reply_enabled && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      Public reply
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {automation.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center rounded-md bg-purple-50 border border-purple-200/60 px-2 py-0.5 text-xs font-medium text-purple-700"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 max-w-md text-xs text-white line-clamp-3 whitespace-pre-line rounded-2xl rounded-bl-md bg-gradient-to-br from-purple-600 to-indigo-600 px-3 py-2">
                  {automation.dm_message}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleActive(automation)}
                  disabled={busyId === automation.id}
                  title={automation.is_active ? "Pause" : "Activate"}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    automation.is_active ? "bg-purple-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                      automation.is_active ? "translate-x-[22px]" : "translate-x-0.5"
                    )}
                  />
                </button>
                <button
                  onClick={() => {
                    setEditing(automation)
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
            </div>
          </div>
        ))}
      </section>

      {/* Recent activity */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
          <button
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {initialLogs.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 bg-white p-6 text-center">
            <p className="text-xs text-slate-500">
              No activity yet. When someone comments a trigger keyword, the send
              shows up here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5 font-semibold">Commenter</th>
                  <th className="px-4 py-2.5 font-semibold">Comment</th>
                  <th className="px-4 py-2.5 font-semibold">Automation</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {initialLogs.map((log) => (
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
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {automationNames.get(log.automation_id) ?? "—"}
                    </td>
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
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                      {formatRelative(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <AutomationForm
          key={editing?.id ?? "new"}
          account={account}
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={(saved, isNew) => {
            setAutomations((prev) =>
              isNew ? [saved, ...prev] : prev.map((a) => (a.id === saved.id ? saved : a))
            )
            setShowForm(false)
            trackEvent(isNew ? "dm_automation_created" : "dm_automation_updated")
          }}
        />
      )}
    </div>
  )
}

function NotConnectedState() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          DM Automation
        </h1>
        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Beta
        </span>
      </div>
      <p className="text-slate-500 text-sm mt-0.5">
        Turn comments into conversations, automatically
      </p>

      <div className="mt-6 rounded-xl border border-slate-200/60 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm">
          <InstagramIcon className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 mt-4">
          Connect your Instagram account
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          When someone comments a keyword like{" "}
          <span className="font-semibold text-slate-700">&ldquo;LINK&rdquo;</span>{" "}
          on your post or reel, they automatically get a DM from you — within a
          minute. Uses Instagram&rsquo;s official API: no password sharing, no
          scraping, fully within Meta&rsquo;s rules.
        </p>
        <a
          href="/api/instagram/connect"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
        >
          <InstagramIcon className="h-4 w-4" />
          Connect Instagram
        </a>
        <p className="text-[11px] text-slate-400 mt-4 max-w-sm mx-auto">
          Requires an Instagram <strong>Business or Creator</strong> account.
          During the beta, your account also needs to be added as a tester —
          contact us and we&rsquo;ll set you up in minutes.
        </p>
      </div>
    </div>
  )
}

function AutomationForm({
  account,
  editing,
  onClose,
  onSaved,
}: {
  account: DmAccount
  editing: DmAutomation | null
  onClose: () => void
  onSaved: (automation: DmAutomation, isNew: boolean) => void
}) {
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          name: editing.name,
          matchAnyPost: editing.match_any_post,
          postId: editing.post_id,
          postUrl: editing.post_url,
          keywords: editing.keywords,
          wholeWordMatch: editing.whole_word_match,
          dmMessage: editing.dm_message,
          publicReplyEnabled: editing.public_reply_enabled,
          publicReplyMessage: editing.public_reply_message ?? "",
        }
      : EMPTY_FORM
  )
  const [keywordInput, setKeywordInput] = useState("")
  const [posts, setPosts] = useState<InstagramPost[] | null>(null)
  const [postsError, setPostsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<PreviewMode>("comment")

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
    if (!form.matchAnyPost && !form.postId)
      return setFormError("Pick a post, or switch to “Any post”.")
    if (!form.dmMessage.trim()) return setFormError("Write the DM message.")
    if (form.publicReplyEnabled && !form.publicReplyMessage.trim())
      return setFormError("Write the public reply, or turn it off.")

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        match_any_post: form.matchAnyPost,
        post_id: form.matchAnyPost ? null : form.postId,
        post_url: form.matchAnyPost ? null : form.postUrl,
        keywords,
        whole_word_match: form.wholeWordMatch,
        dm_message: form.dmMessage,
        public_reply_enabled: form.publicReplyEnabled,
        public_reply_message: form.publicReplyEnabled
          ? form.publicReplyMessage
          : null,
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

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Settings */}
          <div className="min-h-0 overflow-y-auto lg:w-[460px] lg:shrink-0 lg:border-r lg:border-slate-100">
            <div className="space-y-7 px-4 py-6 sm:px-6">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}

              {/* Step 1: post */}
              <Step n={1} title="When someone comments on">
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
                      <div className="grid grid-cols-4 gap-1.5 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5">
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
                              "relative aspect-[4/5] overflow-hidden rounded-md border-2 transition-all",
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
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[9px] text-slate-400 p-1 text-center">
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

              {/* Step 2: keywords */}
              <Step n={2} title="And the comment contains">
                <div
                  onFocus={() => setPreviewMode("comment")}
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

              {/* Step 3: DM */}
              <Step n={3} title="They will get a DM">
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
              </Step>

              {/* Step 4: public reply */}
              <Step n={4} title="And a public reply" optional>
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
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        form.publicReplyEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </label>
                {form.publicReplyEnabled && (
                  <input
                    type="text"
                    value={form.publicReplyMessage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, publicReplyMessage: e.target.value }))
                    }
                    onFocus={() => setPreviewMode("comment")}
                    placeholder={"Sent you a DM! 📩"}
                    className={cn(inputCls, "mt-3 h-10")}
                  />
                )}
              </Step>
            </div>
          </div>

          {/* Live preview */}
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-slate-50 px-4 py-6 lg:justify-center">
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
              publicReplyMessage={form.publicReplyMessage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  tone: "purple" | "slate" | "red"
}) {
  const tones = {
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-slate-100 text-slate-500",
    red: "bg-red-50 text-red-500",
  }
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            tones[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900 leading-tight tabular-nums">
            {value}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{label}</p>
        </div>
      </div>
    </div>
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
