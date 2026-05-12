/**
 * Thin wrapper around the GA4 `gtag` global. Safe to call from anywhere
 * in client code — silently no-ops when:
 *   - running on the server (no window),
 *   - the GA script hasn't injected gtag yet (race during early mount),
 *   - `NEXT_PUBLIC_GA_ID` isn't set (dev / local).
 *
 * Always fire from the success path of an action (after the response /
 * state transition), never on the click — we want conversion data, not
 * click data. A user spamming a button shouldn't inflate the metric.
 */

type GAValue = string | number | boolean | null | undefined

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

export function trackEvent(
  name: string,
  params: Record<string, GAValue> = {},
): void {
  if (typeof window === "undefined") return
  if (typeof window.gtag !== "function") return
  try {
    window.gtag("event", name, params)
  } catch (e) {
    // Never let a tracking error bubble up and break the surrounding flow.
    console.warn(`[analytics] trackEvent("${name}") failed:`, e)
  }
}

/**
 * Read the captured UTM source from sessionStorage. The signup page
 * stashes it on mount; the signup POST handler reads from the same
 * stash so we don't need to wire it through every form state.
 */
export const UTM_SOURCE_KEY = "sg.utm_source"

export function captureUtmSource(): string | null {
  if (typeof window === "undefined") return null
  try {
    const url = new URL(window.location.href)
    const fresh = url.searchParams.get("utm_source")
    if (fresh) {
      window.sessionStorage.setItem(UTM_SOURCE_KEY, fresh.slice(0, 64))
      return fresh.slice(0, 64)
    }
    return window.sessionStorage.getItem(UTM_SOURCE_KEY)
  } catch {
    return null
  }
}
