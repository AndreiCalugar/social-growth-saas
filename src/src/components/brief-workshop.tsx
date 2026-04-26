"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Clapperboard,
  Fish,
  FileText,
  Calendar,
  Hash,
  StickyNote,
  Copy,
  Check,
  Trash2,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react"

export interface SavedBrief {
  id: string
  user_id: string
  trend_insight_id: string | null
  trend_name: string
  performance_multiplier: number | null
  original_content: string | null
  original_hook: string | null
  original_caption: string | null
  original_posting_time: string | null
  original_hashtags: string[] | null
  hook_variations: HookVariation[] | null
  content_angles: ContentAngle[] | null
  caption_variations: CaptionVariation[] | null
  chosen_hook: string | null
  chosen_content: string | null
  chosen_caption: string | null
  chosen_posting_time: string | null
  chosen_hashtags: string[] | null
  user_notes: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  status: BriefStatus
  created_at: string
  updated_at: string
}

export type BriefStatus = "saved" | "planning" | "filming" | "filmed" | "posted"
export interface HookVariation { style?: string; hook?: string; why?: string }
export interface ContentAngle { angle?: string; description?: string }
export interface CaptionVariation { style?: string; caption?: string }

const STATUS_OPTIONS: { value: BriefStatus; label: string; cls: string }[] = [
  { value: "saved",    label: "Saved",    cls: "bg-slate-100   text-slate-700   border-slate-200" },
  { value: "planning", label: "Planning", cls: "bg-blue-50     text-blue-700    border-blue-200" },
  { value: "filming",  label: "Filming",  cls: "bg-amber-50    text-amber-700   border-amber-200" },
  { value: "filmed",   label: "Filmed",   cls: "bg-purple-50   text-purple-700  border-purple-200" },
  { value: "posted",   label: "Posted",   cls: "bg-emerald-50  text-emerald-700 border-emerald-200" },
]

export function BriefWorkshop({ initialBrief }: { initialBrief: SavedBrief }) {
  const router = useRouter()
  const [brief, setBrief] = useState<SavedBrief>(initialBrief)
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set())
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expanding, setExpanding] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [captionTab, setCaptionTab] = useState<"original" | number>("original")
  const [newHashtag, setNewHashtag] = useState("")

  async function saveField(patch: Partial<SavedBrief>) {
    const fields = Object.keys(patch)
    setSavingFields((s) => {
      const next = new Set(s)
      fields.forEach((f) => next.add(f))
      return next
    })
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/briefs/${brief.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Save failed (${res.status})`)
      setBrief(json.brief)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSavingFields((s) => {
        const next = new Set(s)
        fields.forEach((f) => next.delete(f))
        return next
      })
    }
  }

  async function handleExpand() {
    setExpanding(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/briefs/${brief.id}/expand`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Generation failed (${res.status})`)
      setBrief(json.brief)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setExpanding(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/briefs/${brief.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Delete failed (${res.status})`)
      }
      router.push("/insights")
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Delete failed")
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  function buildFinalBrief(): string {
    const lines: string[] = []
    lines.push(`🎬 ${brief.trend_name}`)
    if (brief.performance_multiplier) {
      lines.push(`📊 ${brief.performance_multiplier.toFixed(1)}× avg engagement`)
    }
    lines.push("")
    const content = brief.chosen_content ?? brief.original_content
    const hook = brief.chosen_hook ?? brief.original_hook
    const caption = brief.chosen_caption ?? brief.original_caption
    const time = brief.chosen_posting_time ?? brief.original_posting_time
    const tagsArr = (brief.chosen_hashtags?.length ? brief.chosen_hashtags : brief.original_hashtags) ?? []
    if (content) lines.push(`CONTENT: ${content}`)
    if (hook) lines.push(`HOOK: ${hook}`)
    if (caption) lines.push(`CAPTION: ${caption}`)
    if (time) lines.push(`POST: ${time}`)
    if (tagsArr.length) {
      lines.push(`TAGS: ${tagsArr.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}`)
    }
    if (brief.user_notes && brief.user_notes.trim()) {
      lines.push("")
      lines.push("NOTES:")
      lines.push(brief.user_notes.trim())
    }
    return lines.join("\n")
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildFinalBrief())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const chosenHook = brief.chosen_hook ?? ""
  const chosenContent = brief.chosen_content ?? brief.original_content ?? ""
  const chosenCaption = brief.chosen_caption ?? brief.original_caption ?? ""
  const chosenTags = brief.chosen_hashtags?.length ? brief.chosen_hashtags : (brief.original_hashtags ?? [])
  const chosenNotes = brief.user_notes ?? ""

  const hasExpansion =
    (brief.hook_variations?.length ?? 0) > 0 ||
    (brief.content_angles?.length ?? 0) > 0 ||
    (brief.caption_variations?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {brief.trend_name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Saved {new Date(brief.created_at).toLocaleDateString()} · Last updated{" "}
              {new Date(brief.updated_at).toLocaleString()}
            </p>
          </div>
          {brief.performance_multiplier ? (
            <span className="shrink-0 inline-flex items-baseline gap-0.5 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-bold text-white tabular-nums shadow-sm">
              {brief.performance_multiplier.toFixed(1)}
              <span className="text-[11px] font-semibold text-slate-300">×</span>
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Status
          </span>
          {STATUS_OPTIONS.map((opt) => {
            const active = brief.status === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (active) return
                  saveField({ status: opt.value })
                }}
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                  active ? `${opt.cls} ring-1 ring-offset-1 ring-slate-300` : `${opt.cls} opacity-60 hover:opacity-100`
                }`}
              >
                {opt.label}
              </button>
            )
          })}
          {savingFields.has("status") && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Section 1 — Content format */}
      <Section icon={Clapperboard} label="Content format" tone="purple" saving={savingFields.has("chosen_content")}>
        <AutoSaveTextarea
          value={chosenContent}
          placeholder="Describe how this content should be filmed and structured…"
          onSave={(v) => saveField({ chosen_content: v })}
          rows={3}
        />
        {brief.original_content && brief.chosen_content && brief.chosen_content !== brief.original_content && (
          <p className="mt-2 text-[11px] text-slate-400">
            <span className="font-semibold">Original:</span> {brief.original_content}
          </p>
        )}
      </Section>

      {/* Section 2 — Hooks */}
      <Section icon={Fish} label="Opening hook" tone="amber">
        {brief.original_hook && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
              Original hook
            </p>
            <p className="text-sm text-amber-900">{brief.original_hook}</p>
          </div>
        )}

        {!hasExpansion && (
          <button
            onClick={handleExpand}
            disabled={expanding}
            className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {expanding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating variations…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate variations with AI
              </>
            )}
          </button>
        )}

        {hasExpansion && brief.hook_variations && brief.hook_variations.length > 0 && (
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {brief.hook_variations.map((v, i) => {
              const selected = chosenHook && v.hook && chosenHook === v.hook
              return (
                <button
                  key={i}
                  onClick={() => saveField({ chosen_hook: v.hook ?? "" })}
                  className={`text-left rounded-lg border p-3 transition shadow-sm ${
                    selected
                      ? "border-purple-500 bg-purple-50/70 ring-2 ring-purple-200"
                      : "border-slate-200 bg-white hover:border-purple-300 hover:shadow"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                      {v.style ?? `Option ${i + 1}`}
                    </span>
                    {selected && <Check className="h-3.5 w-3.5 text-purple-600" />}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {v.hook ?? "—"}
                  </p>
                  {v.why && (
                    <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                      {v.why}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {hasExpansion && brief.content_angles && brief.content_angles.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Filming angles
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {brief.content_angles.map((a, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {a.angle ?? `Angle ${i + 1}`}
                  </p>
                  <p className="text-xs text-slate-700 leading-snug">{a.description ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Custom hook
          </label>
          <AutoSaveInput
            value={chosenHook}
            placeholder="Or write your own hook…"
            onSave={(v) => saveField({ chosen_hook: v })}
            saving={savingFields.has("chosen_hook")}
          />
        </div>
      </Section>

      {/* Section 3 — Caption structure */}
      <Section icon={FileText} label="Caption structure" tone="slate" saving={savingFields.has("chosen_caption")}>
        {brief.caption_variations && brief.caption_variations.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1 mb-3">
              <CaptionTab
                active={captionTab === "original"}
                label="Original"
                onClick={() => setCaptionTab("original")}
              />
              {brief.caption_variations.map((v, i) => (
                <CaptionTab
                  key={i}
                  active={captionTab === i}
                  label={v.style ?? `Variation ${i + 1}`}
                  onClick={() => setCaptionTab(i)}
                />
              ))}
            </div>
            {captionTab !== "original" && brief.caption_variations[captionTab] && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 mb-3">
                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                  {brief.caption_variations[captionTab].caption ?? "—"}
                </p>
                <button
                  onClick={() =>
                    saveField({
                      chosen_caption: brief.caption_variations![captionTab as number].caption ?? "",
                    })
                  }
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-50"
                >
                  Use this caption
                </button>
              </div>
            )}
          </>
        ) : null}

        <AutoSaveTextarea
          value={chosenCaption}
          placeholder="Outline your caption structure or write the full caption here…"
          onSave={(v) => saveField({ chosen_caption: v })}
          rows={4}
        />
        {brief.original_caption && brief.chosen_caption && brief.chosen_caption !== brief.original_caption && (
          <p className="mt-2 text-[11px] text-slate-400">
            <span className="font-semibold">Original:</span> {brief.original_caption}
          </p>
        )}
      </Section>

      {/* Section 4 — Schedule */}
      <Section icon={Calendar} label="Posting schedule" tone="emerald">
        {brief.original_posting_time && (
          <p className="text-xs text-slate-500 mb-3">
            <span className="font-semibold text-emerald-700">AI recommends:</span>{" "}
            {brief.original_posting_time}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Date
            </label>
            <input
              type="date"
              defaultValue={brief.scheduled_date ?? ""}
              onBlur={(e) => {
                const value = e.target.value || null
                if (value !== (brief.scheduled_date ?? null)) saveField({ scheduled_date: value })
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Time
            </label>
            <input
              type="time"
              defaultValue={brief.scheduled_time ?? ""}
              onBlur={(e) => {
                const value = e.target.value || null
                if (value !== (brief.scheduled_time ?? null)) saveField({ scheduled_time: value })
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          </div>
        </div>
        {(savingFields.has("scheduled_date") || savingFields.has("scheduled_time")) && (
          <p className="mt-2 text-[11px] text-slate-400 inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </p>
        )}
      </Section>

      {/* Section 5 — Hashtags */}
      <Section icon={Hash} label="Hashtags" tone="slate" saving={savingFields.has("chosen_hashtags")}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chosenTags.length === 0 && (
            <span className="text-xs text-slate-400">No hashtags yet — add some below.</span>
          )}
          {chosenTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700"
            >
              #{tag.replace(/^#/, "")}
              <button
                onClick={() =>
                  saveField({
                    chosen_hashtags: chosenTags.filter((t) => t !== tag),
                  })
                }
                aria-label={`Remove ${tag}`}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const clean = newHashtag.replace(/^#/, "").trim()
            if (!clean) return
            if (chosenTags.includes(clean)) {
              setNewHashtag("")
              return
            }
            saveField({ chosen_hashtags: [...chosenTags, clean] })
            setNewHashtag("")
          }}
          className="flex gap-2"
        >
          <input
            value={newHashtag}
            onChange={(e) => setNewHashtag(e.target.value)}
            placeholder="Add hashtag"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Add
          </button>
        </form>
      </Section>

      {/* Section 6 — Notes */}
      <Section icon={StickyNote} label="My notes" tone="slate" saving={savingFields.has("user_notes")}>
        <AutoSaveTextarea
          value={chosenNotes}
          placeholder="Add filming locations, shot ideas, or reminders…"
          onSave={(v) => saveField({ user_notes: v })}
          rows={4}
        />
      </Section>

      {/* Footer actions */}
      <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
            copied ? "bg-emerald-600" : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" /> Copied to clipboard
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copy final brief
            </>
          )}
        </button>

        {confirmDelete ? (
          <div className="inline-flex items-center gap-2">
            <span className="text-xs text-slate-600">Delete this brief?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Confirm delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete brief
          </button>
        )}
      </div>
    </div>
  )
}

const sectionTone: Record<
  "purple" | "amber" | "slate" | "emerald",
  { icon: string; label: string }
> = {
  purple:  { icon: "text-purple-600",  label: "text-purple-700" },
  amber:   { icon: "text-amber-600",   label: "text-amber-700" },
  slate:   { icon: "text-slate-500",   label: "text-slate-500" },
  emerald: { icon: "text-emerald-600", label: "text-emerald-700" },
}

function Section({
  icon: Icon,
  label,
  tone = "slate",
  saving = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone?: "purple" | "amber" | "slate" | "emerald"
  saving?: boolean
  children: React.ReactNode
}) {
  const t = sectionTone[tone]
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white shadow-sm p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-4 w-4 ${t.icon}`} />
        <h2 className={`text-[11px] font-bold uppercase tracking-wider ${t.label}`}>
          {label}
        </h2>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      </div>
      {children}
    </section>
  )
}

function AutoSaveInput({
  value,
  placeholder,
  onSave,
  saving,
}: {
  value: string
  placeholder?: string
  onSave: (v: string) => void
  saving?: boolean
}) {
  const [local, setLocal] = useState(value)
  return (
    <div className="relative">
      <input
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onSave(local)
        }}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
      />
      {saving && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400" />
      )}
    </div>
  )
}

function AutoSaveTextarea({
  value,
  placeholder,
  onSave,
  rows = 3,
}: {
  value: string
  placeholder?: string
  onSave: (v: string) => void
  rows?: number
}) {
  const [local, setLocal] = useState(value)
  return (
    <textarea
      value={local}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onSave(local)
      }}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-y"
    />
  )
}

function CaptionTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
        active
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
      }`}
    >
      {label}
    </button>
  )
}
