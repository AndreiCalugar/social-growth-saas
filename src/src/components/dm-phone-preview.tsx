"use client"

import {
  BatteryFull,
  Camera,
  ChevronLeft,
  Heart,
  Image as ImageIcon,
  Mic,
  Phone,
  Send,
  Signal,
  Smile,
  Video,
  Wifi,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type PreviewMode = "comment" | "dm"

// Stand-in for the person commenting — the preview shows what *they* see.
const FOLLOWER = "your.follower"

/**
 * Live phone mock-up of what a commenter experiences: the comment thread with
 * the public reply, and the DM that lands in their inbox. Pure Tailwind, styled
 * after Instagram's dark theme; it re-renders as the automation form changes.
 */
export function DmPhonePreview({
  mode,
  onModeChange,
  username,
  avatarUrl,
  postThumbnail,
  keyword,
  dmMessage,
  publicReplyEnabled,
  publicReplyMessage,
}: {
  mode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
  username: string
  avatarUrl: string | null
  postThumbnail: string | null
  keyword: string
  dmMessage: string
  publicReplyEnabled: boolean
  publicReplyMessage: string
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-[290px] rounded-[2.75rem] bg-slate-900 p-2.5 shadow-2xl shadow-slate-900/30 ring-1 ring-slate-700">
        <div className="flex h-[580px] flex-col overflow-hidden rounded-[2.25rem] bg-black text-white">
          <StatusBar />
          {mode === "dm" ? (
            <DmScreen
              username={username}
              avatarUrl={avatarUrl}
              keyword={keyword}
              dmMessage={dmMessage}
            />
          ) : (
            <CommentScreen
              username={username}
              avatarUrl={avatarUrl}
              postThumbnail={postThumbnail}
              keyword={keyword}
              publicReplyEnabled={publicReplyEnabled}
              publicReplyMessage={publicReplyMessage}
            />
          )}
        </div>
      </div>

      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {(["comment", "dm"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
              mode === m
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            {m === "comment" ? "Comment" : "DM"}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    <div className="relative flex h-11 shrink-0 items-center justify-between px-6 text-[13px] font-semibold">
      <span>9:41</span>
      <span className="absolute left-1/2 top-2.5 h-[22px] w-[80px] -translate-x-1/2 rounded-full bg-slate-900" />
      <span className="flex items-center gap-1">
        <Signal className="h-3.5 w-3.5" />
        <Wifi className="h-3.5 w-3.5" />
        <BatteryFull className="h-4 w-4" />
      </span>
    </div>
  )
}

function Avatar({
  src,
  name,
  size = "h-7 w-7",
}: {
  src: string | null
  name: string
  size?: string
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={cn(size, "shrink-0 rounded-full object-cover")}
    />
  ) : (
    <div
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-[10px] font-bold uppercase"
      )}
    >
      {name.charAt(0)}
    </div>
  )
}

function FollowerAvatar({ size = "h-7 w-7" }: { size?: string }) {
  return (
    <div
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 text-[10px] font-bold"
      )}
    >
      Y
    </div>
  )
}

// Render URLs as links the way Instagram does in DMs.
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <span key={i} className="underline underline-offset-2 break-all">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function DmScreen({
  username,
  avatarUrl,
  keyword,
  dmMessage,
}: {
  username: string
  avatarUrl: string | null
  keyword: string
  dmMessage: string
}) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-3 pb-2.5">
        <ChevronLeft className="h-6 w-6" />
        <Avatar src={avatarUrl} name={username} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">
            {username}
          </p>
          <p className="text-[10px] text-white/50">Instagram</p>
        </div>
        <Phone className="h-5 w-5" />
        <Video className="h-5 w-5" />
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2 overflow-y-auto px-3 py-4">
        <div className="mb-2 flex flex-col items-center gap-1.5 text-center">
          <Avatar src={avatarUrl} name={username} size="h-16 w-16" />
          <p className="text-sm font-semibold">{username}</p>
          <p className="text-[10px] text-white/50">
            Replied to your comment &ldquo;{keyword}&rdquo;
          </p>
        </div>

        <div className="flex items-end gap-2">
          <Avatar src={avatarUrl} name={username} size="h-6 w-6" />
          <div
            className={cn(
              "max-w-[78%] whitespace-pre-line rounded-2xl rounded-bl-md px-3 py-2 text-[12.5px] leading-snug",
              dmMessage.trim() ? "bg-[#262626]" : "bg-[#262626]/60 italic text-white/40"
            )}
          >
            {dmMessage.trim() ? (
              <Linkified text={dmMessage} />
            ) : (
              "Your DM will appear here…"
            )}
          </div>
        </div>
      </div>

      <div className="mx-3 mb-4 flex shrink-0 items-center gap-2 rounded-full bg-[#262626] px-2 py-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500">
          <Camera className="h-4 w-4" />
        </span>
        <span className="flex-1 text-[12px] text-white/40">Message…</span>
        <Mic className="h-4 w-4 text-white/80" />
        <ImageIcon className="h-4 w-4 text-white/80" />
        <Smile className="mr-1 h-4 w-4 text-white/80" />
      </div>
    </>
  )
}

function CommentScreen({
  username,
  avatarUrl,
  postThumbnail,
  keyword,
  publicReplyEnabled,
  publicReplyMessage,
}: {
  username: string
  avatarUrl: string | null
  postThumbnail: string | null
  keyword: string
  publicReplyEnabled: boolean
  publicReplyMessage: string
}) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2">
        <Avatar src={avatarUrl} name={username} size="h-6 w-6" />
        <p className="truncate text-[12px] font-semibold">{username}</p>
      </div>

      <div className="relative h-[190px] shrink-0 bg-[#1a1a1a]">
        {postThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={postThumbnail}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-white/30">
            Your post
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-t-2xl bg-[#1c1c1c] px-3 pt-2">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-white/20" />
        <p className="mb-3 text-center text-[12px] font-semibold">Comments</p>

        <div className="flex gap-2">
          <FollowerAvatar />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold">
              {FOLLOWER} <span className="font-normal text-white/40">1m</span>
            </p>
            <p className="text-[12.5px]">{keyword}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-white/40">Reply</p>
          </div>
          <Heart className="mt-1 h-3.5 w-3.5 text-white/40" />
        </div>

        {publicReplyEnabled && (
          <div className="ml-9 mt-3 flex gap-2">
            <Avatar src={avatarUrl} name={username} size="h-6 w-6" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold">
                {username} <span className="font-normal text-white/40">now</span>
              </p>
              <p
                className={cn(
                  "text-[12.5px]",
                  !publicReplyMessage.trim() && "italic text-white/40"
                )}
              >
                {publicReplyMessage.trim() ? (
                  <>
                    <span className="text-sky-300">@{FOLLOWER}</span>{" "}
                    {publicReplyMessage}
                  </>
                ) : (
                  "Your public reply…"
                )}
              </p>
            </div>
            <Heart className="mt-1 h-3.5 w-3.5 text-white/40" />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 bg-[#1c1c1c] px-3 pb-4 pt-2">
        <FollowerAvatar size="h-7 w-7" />
        <span className="flex-1 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/40">
          Add a comment…
        </span>
        <Send className="h-4 w-4 text-white/60" />
      </div>
    </>
  )
}
