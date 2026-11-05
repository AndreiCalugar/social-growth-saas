"use client"

import { useEffect, useState } from "react"
import {
  BatteryFull,
  Camera,
  ChevronLeft,
  Heart,
  Mic,
  Phone,
  Signal,
  Video,
  Wifi,
} from "lucide-react"
import { cn } from "@/lib/utils"

// The story the hero plays on loop: a follower comments, the account replies
// publicly, then the DM lands. Timestamps are real — the first DM a stranger
// received through the app arrived 16 seconds after their comment.
const PHASES = [
  { ms: 900 }, // 0 post, no comments yet
  { ms: 1800 }, // 1 follower comments
  { ms: 1800 }, // 2 public reply appears
  { ms: 1300 }, // 3 DM screen, typing
  { ms: 3600 }, // 4 DM delivered
] as const

const CREATOR = "contul.tau"
const FOLLOWER = "andreea_m"

const TIMELINE = [
  { at: "0:00", label: `@${FOLLOWER} comentează „LINK”`, phase: 1 },
  { at: "0:03", label: "Răspuns public sub comentariu", phase: 2 },
  { at: "0:16", label: "Linkul ajunge în DM", phase: 4 },
]

export function PhoneDemo() {
  const [phase, setPhase] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      setPhase(4)
      return
    }
    const t = setTimeout(
      () => setPhase((p) => (p + 1) % PHASES.length),
      PHASES[phase].ms
    )
    return () => clearTimeout(t)
  }, [phase, reducedMotion])

  return (
    <div className="flex flex-col items-center gap-7">
      <div
        className="w-[272px] shrink-0 rounded-[2.6rem] bg-ink p-2.5 shadow-[0_40px_80px_-30px_rgba(23,19,31,0.55)]"
        aria-hidden
      >
        <div className="flex h-[548px] flex-col overflow-hidden rounded-[2.1rem] bg-black text-white">
          <StatusBar />
          {phase < 3 ? <CommentsScreen phase={phase} /> : <DmScreen phase={phase} />}
        </div>
      </div>

      <ol className="w-[272px] space-y-3" aria-label="Ce se întâmplă">
        {TIMELINE.map((step) => {
          const done = phase >= step.phase
          return (
            <li
              key={step.at}
              className={cn(
                "flex items-start gap-3 transition-opacity duration-300",
                done ? "opacity-100" : "opacity-35"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-stamp text-[11px] font-medium tabular-nums transition-colors duration-300",
                  done
                    ? step.phase === 4
                      ? "bg-sent text-white"
                      : "bg-ink text-white"
                    : "bg-mist text-ink-soft"
                )}
              >
                {step.at}
              </span>
              <span className="text-sm leading-snug text-ink">{step.label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function StatusBar() {
  return (
    <div className="relative flex h-10 shrink-0 items-center justify-between px-6 text-[12px] font-semibold">
      <span>9:41</span>
      <span className="absolute left-1/2 top-2 h-[20px] w-[74px] -translate-x-1/2 rounded-full bg-ink" />
      <span className="flex items-center gap-1">
        <Signal className="h-3 w-3" />
        <Wifi className="h-3 w-3" />
        <BatteryFull className="h-3.5 w-3.5" />
      </span>
    </div>
  )
}

function CreatorAvatar({ size = "h-6 w-6" }: { size?: string }) {
  return (
    <div
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-full bg-coral font-display text-[10px] font-bold"
      )}
    >
      C
    </div>
  )
}

function FollowerAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7c6cf0] text-[10px] font-bold">
      A
    </div>
  )
}

function CommentsScreen({ phase }: { phase: number }) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2">
        <CreatorAvatar />
        <p className="text-[11.5px] font-semibold">{CREATOR}</p>
      </div>

      {/* The post: a carousel cover, the kind that ends with "comment LINK". */}
      <div className="relative flex h-[200px] shrink-0 flex-col justify-end bg-gradient-to-br from-coral to-[#ff8a5c] p-4">
        <p className="font-display text-[22px] font-extrabold leading-[1.05] tracking-tight text-white">
          Ghidul meu gratuit pentru primul reel
        </p>
        <p className="mt-2 inline-flex w-fit rounded-full bg-white px-2.5 py-1 text-[10.5px] font-semibold text-ink">
          Comentează „LINK” și ți-l trimit
        </p>
      </div>

      <div className="flex-1 rounded-t-2xl bg-[#1c1c1c] px-3 pt-2">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-white/20" />
        <p className="mb-3 text-center text-[11.5px] font-semibold">Comentarii</p>

        {phase >= 1 && (
          <div className="demo-in flex gap-2">
            <FollowerAvatar />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold">
                {FOLLOWER} <span className="font-normal text-white/40">acum</span>
              </p>
              <p className="text-[12.5px]">LINK 🙏</p>
            </div>
            <Heart className="mt-1 h-3 w-3 text-white/40" />
          </div>
        )}

        {phase >= 2 && (
          <div className="demo-in ml-9 mt-3 flex gap-2">
            <CreatorAvatar />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold">
                {CREATOR} <span className="font-normal text-white/40">acum</span>
              </p>
              <p className="text-[12.5px]">
                <span className="text-sky-300">@{FOLLOWER}</span> Ți-am trimis în
                DM! 📩
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function DmScreen({ phase }: { phase: number }) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-3 pb-2.5">
        <ChevronLeft className="h-5 w-5" />
        <CreatorAvatar size="h-7 w-7" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold leading-tight">{CREATOR}</p>
          <p className="text-[9.5px] text-white/50">Instagram</p>
        </div>
        <Phone className="h-4.5 w-4.5" />
        <Video className="h-4.5 w-4.5" />
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2 px-3 py-4">
        <p className="mb-1 text-center text-[9.5px] text-white/45">
          A răspuns la comentariul tău „LINK 🙏”
        </p>
        <div className="flex items-end gap-2">
          <CreatorAvatar />
          {phase === 3 ? (
            <div className="demo-in flex gap-1 rounded-2xl rounded-bl-md bg-[#262626] px-3 py-3">
              <span className="demo-dot h-1.5 w-1.5 rounded-full bg-white/70" />
              <span className="demo-dot h-1.5 w-1.5 rounded-full bg-white/70" />
              <span className="demo-dot h-1.5 w-1.5 rounded-full bg-white/70" />
            </div>
          ) : (
            <div className="demo-in max-w-[80%] rounded-2xl rounded-bl-md bg-[#262626] px-3 py-2 text-[12px] leading-snug">
              Salut, Andreea! 👋 Uite ghidul promis:{" "}
              <span className="underline underline-offset-2">
                contultau.ro/ghid-reel
              </span>
              <br />
              Spor la filmat! 🎬
            </div>
          )}
        </div>
      </div>

      <div className="mx-3 mb-4 flex shrink-0 items-center gap-2 rounded-full bg-[#262626] px-2 py-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
          <Camera className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 text-[11px] text-white/40">Mesaj…</span>
        <Mic className="mr-1 h-3.5 w-3.5 text-white/80" />
      </div>
    </>
  )
}
