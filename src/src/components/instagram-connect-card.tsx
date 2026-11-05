"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { InstagramIcon } from "@/components/instagram-icon"
import { InstagramAccountAvatar } from "@/components/instagram-account-avatar"
import type { ConnectedInstagramAccount } from "@/lib/meta/accounts"

// Feedback for the ?instagram= query param set by the OAuth callback.
const STATUS_MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Instagram account connected." },
  denied: { tone: "error", text: "You cancelled the Instagram authorization." },
  invalid: { tone: "error", text: "The authorization link was invalid or expired — try again." },
  forbidden: { tone: "error", text: "This authorization was started from a different login. Try again." },
  already_connected: { tone: "error", text: "That Instagram account is already connected to another user." },
  failed: { tone: "error", text: "Connecting failed." },
  misconfigured: { tone: "error", text: "Instagram integration isn't configured on the server yet." },
}

export function InstagramConnectCard({
  account,
  betaApproved,
}: {
  account: ConnectedInstagramAccount | null
  // Not-yet-approved beta users request access on /dms instead of connecting.
  betaApproved: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [disconnecting, setDisconnecting] = useState(false)

  const status = searchParams.get("instagram")
  const reason = searchParams.get("reason")
  const feedback = status ? STATUS_MESSAGES[status] : null

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect Instagram? All your DM automations and their send history will be permanently deleted. You can reconnect later, but you'll need to recreate your automations."
      )
    ) {
      return
    }
    setDisconnecting(true)
    try {
      const res = await fetch("/api/instagram/disconnect", { method: "POST" })
      if (!res.ok) throw new Error("Failed to disconnect")
      router.refresh()
    } catch {
      setDisconnecting(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <InstagramIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Instagram DM Automation
              </h2>
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Beta
              </span>
            </div>
            {account ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2.5">
                  <InstagramAccountAvatar
                    username={account.username}
                    src={account.profile_picture_url}
                    className="h-9 w-9"
                  />
                  <div className="min-w-0">
                    {account.name && (
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {account.name}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      @{account.username}
                      {account.followers_count !== null &&
                        ` · ${account.followers_count.toLocaleString()} followers`}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Connected as{" "}
                  <span className="font-semibold text-slate-700">
                    @{account.username}
                  </span>
                  {account.token_expires_at && (
                    <>
                      {" · token renews before "}
                      {new Date(account.token_expires_at).toLocaleDateString()}
                    </>
                  )}
                </p>
                {account.token_error ? (
                  <p className="inline-flex items-center gap-1 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Connection expired —{" "}
                    <a
                      href="/api/instagram/connect"
                      className="font-semibold underline"
                    >
                      reconnect
                    </a>
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Active{account.webhook_subscribed ? " · webhooks on" : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect an Instagram Business or Creator account to auto-DM
                people who comment your keywords. Official Meta API — no
                password sharing.
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {account ? (
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-60"
            >
              {disconnecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Disconnect
            </button>
          ) : betaApproved ? (
            <a
              href="/api/instagram/connect"
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
            >
              <InstagramIcon className="h-3.5 w-3.5" />
              Connect
            </a>
          ) : (
            <a
              href="/dms"
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
            >
              Request beta access
            </a>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={
            feedback.tone === "ok"
              ? "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
              : "mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          }
        >
          {feedback.text}
          {status === "failed" && reason ? ` (${reason})` : null}
        </div>
      )}
    </section>
  )
}
