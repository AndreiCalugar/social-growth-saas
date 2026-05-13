"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Script from "next/script"
import { X } from "lucide-react"

const STORAGE_KEY = "sg.cookie_consent"
type Consent = "accepted" | "declined"

function readConsent(): Consent | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === "accepted" || v === "declined" ? v : null
  } catch {
    return null
  }
}

function writeConsent(v: Consent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, v)
  } catch {
    // ignore quota / privacy mode
  }
}

/**
 * Consent-gated GA4 + visible banner. Only mounted on public pages
 * (landing + legal) — the logged-in app loads GA4 directly in (app)/layout.
 *
 * The banner is hidden once the user has made a choice (Accept or Decline).
 * GA4 only loads when consent is "accepted".
 */
export function CookieConsentBanner() {
  const [consent, setConsent] = useState<Consent | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setConsent(readConsent())
    setHydrated(true)
  }, [])

  const gaId = process.env.NEXT_PUBLIC_GA_ID

  function accept() {
    writeConsent("accepted")
    setConsent("accepted")
  }
  function decline() {
    writeConsent("declined")
    setConsent("declined")
  }

  if (!hydrated) return null

  return (
    <>
      {consent === "accepted" && gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaId}', { send_page_view: true });
            `}
          </Script>
        </>
      )}

      {consent === null && (
        <div className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:left-1/2 sm:bottom-4 sm:-translate-x-1/2 z-50 max-w-2xl w-auto sm:w-[640px] rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 p-4 sm:p-5">
          <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 leading-relaxed">
                We use cookies to improve your experience. Analytics cookies
                help us understand which pages are useful.{" "}
                <Link
                  href="/cookies"
                  className="text-purple-600 hover:text-purple-700 font-medium underline underline-offset-2"
                >
                  Learn more
                </Link>
                .
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={decline}
                className="h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 text-sm font-medium text-slate-700 transition-colors"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={accept}
                className="h-9 inline-flex items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-700 px-4 text-sm font-medium text-white shadow-sm shadow-purple-500/20 transition-colors"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={decline}
                aria-label="Close (decline)"
                className="sm:hidden absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
