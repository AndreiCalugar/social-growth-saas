"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  CalendarDays,
  Gift,
  HandHeart,
  Link2,
  PenLine,
  X,
} from "lucide-react"
import {
  DM_TEMPLATES,
  LINK_PLACEHOLDER,
  buildTemplateDraft,
  normalizeLink,
  type DmTemplate,
  type TemplateDraft,
  type TemplateId,
  type TemplateLanguage,
} from "@/lib/dm-templates"
import { cn } from "@/lib/utils"

const ICONS: Record<TemplateId, typeof Link2> = {
  link: Link2,
  event: CalendarDays,
  freebie: Gift,
  discount: BadgePercent,
  welcome: HandHeart,
}

const LANGUAGES: { value: TemplateLanguage; label: string }[] = [
  { value: "ro", label: "Română" },
  { value: "en", label: "English" },
]

/**
 * Template gallery for new DM automations. Pick a template, choose the
 * message language and paste a link; the editor then opens prefilled.
 * "inline" sits in the empty state of the DMs page, "modal" opens from the
 * New automation button.
 */
export function DmTemplatePicker({
  variant,
  onPick,
  onScratch,
  onClose,
}: {
  variant: "inline" | "modal"
  onPick: (draft: TemplateDraft) => void
  onScratch: () => void
  onClose?: () => void
}) {
  const [selected, setSelected] = useState<DmTemplate | null>(null)

  // Escape closes the modal, like the editor.
  useEffect(() => {
    if (variant !== "modal" || !onClose) return
    const close = onClose
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [variant, onClose])

  const body = selected ? (
    <TemplateSetup template={selected} onBack={() => setSelected(null)} onPick={onPick} />
  ) : (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {DM_TEMPLATES.map((t) => {
          const Icon = ICONS[t.id]
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-purple-300 hover:shadow-md hover:shadow-purple-500/5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-sm">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {t.title}
                  {t.copy.ro.keyword && (
                    <span className="rounded-md bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-purple-700">
                      {t.copy.ro.keyword}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{t.description}</span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-purple-500" />
            </button>
          )
        })}
      </div>
      <button
        onClick={onScratch}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
      >
        <PenLine className="h-4 w-4" />
        Start from scratch
      </button>
    </div>
  )

  if (variant === "inline") return body

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-slate-50 p-4 shadow-xl sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">New automation</h2>
            <p className="mt-0.5 text-sm text-slate-500">Start from a template. You can change everything afterwards.</p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {body}
      </div>
    </div>
  )
}

// Second step: message language + the creator's link, with a live preview
// of the DM they'll send.
function TemplateSetup({
  template,
  onBack,
  onPick,
}: {
  template: DmTemplate
  onBack: () => void
  onPick: (draft: TemplateDraft) => void
}) {
  const [language, setLanguage] = useState<TemplateLanguage>("ro")
  const [link, setLink] = useState("")
  const [error, setError] = useState<string | null>(null)
  const Icon = ICONS[template.id]
  const copy = template.copy[language]
  const [before, after] = copy.dm.split(LINK_PLACEHOLDER)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (template.linkOptional && !link.trim()) {
      onPick(buildTemplateDraft(template, language, null))
      return
    }
    const url = normalizeLink(link)
    if (!url) {
      setError("Paste a full link, like https://yoursite.com/page")
      return
    }
    onPick(buildTemplateDraft(template, language, url))
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All templates
      </button>

      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{template.title}</p>
          <p className="text-xs text-slate-500">
            {copy.keyword ? (
              <>
                People comment <span className="font-mono font-semibold text-purple-700">{copy.keyword}</span> and get
                your DM.
              </>
            ) : (
              "Anyone who messages you for the first time gets your DM."
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-700">Message language</p>
          <div className="mt-1.5 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLanguage(l.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  language === l.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">{template.linkLabel}</span>
          <input
            type="text"
            inputMode="url"
            autoFocus
            value={link}
            onChange={(e) => {
              setLink(e.target.value)
              setError(null)
            }}
            placeholder="https://"
            className={cn(
              "mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2",
              error
                ? "border-red-300 focus:border-red-400 focus:ring-red-500/20"
                : "border-slate-200 focus:border-purple-500 focus:ring-purple-500/20"
            )}
          />
          {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
        </label>

        <div>
          <p className="text-xs font-semibold text-slate-700">The DM they'll get</p>
          <p className="mt-1.5 max-w-md whitespace-pre-line rounded-2xl rounded-bl-md bg-gradient-to-br from-purple-600 to-indigo-600 px-3.5 py-2.5 text-sm leading-relaxed text-white">
            {template.linkOptional && !link.trim() && copy.dmNoLink ? (
              copy.dmNoLink
            ) : (
              <>
                {before}
                <span className="rounded bg-white/20 px-1 underline decoration-white/50 underline-offset-2">
                  {normalizeLink(link) ?? "your link"}
                </span>
                {after}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          {template.triggers && !template.triggers.includes("comment") ? "Next: review and go live." : "Next: pick the post it runs on."}
        </p>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
