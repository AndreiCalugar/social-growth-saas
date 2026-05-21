"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Mail, Lock, Eye, EyeOff, Loader2, TrendingUp } from "lucide-react"
import { AuthShowcasePanel, AuthMobileBanner } from "@/components/auth-showcase-panel"
import { trackEvent } from "@/lib/analytics"

export default function LoginPage() {
  const router = useRouter()
  const search = useSearchParams()
  const callbackUrl = search.get("callbackUrl") || "/overview"
  // NextAuth redirects OAuth failures back here with one of these codes
  // (Google denied, user cancelled, misconfigured client, etc). We collapse
  // them into a single friendly line and let the user retry.
  const errorCode = search.get("error")
  const oauthErrored =
    errorCode === "OAuthSignin" ||
    errorCode === "OAuthCallback" ||
    errorCode === "OAuthCreateAccount" ||
    errorCode === "Callback" ||
    errorCode === "AccessDenied"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(
    oauthErrored ? "Google sign-in didn’t finish. Please try again." : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    })
    setSubmitting(false)
    if (!res || res.error) {
      // Distinguish "wrong password" from "this account uses Google" so
      // we can point the user at the right button instead of looping
      // them through password retries.
      const method = await fetchLoginMethod(email)
      if (method === "google") {
        setError("This account uses Google sign-in. Click Continue with Google above.")
      } else {
        setError("Invalid email or password.")
      }
      setShakeKey((k) => k + 1)
      return
    }
    trackEvent("login_completed", { method: "email" })
    router.push(res.url || callbackUrl)
    router.refresh()
  }

  async function onGoogleClick() {
    setError(null)
    setGoogleLoading(true)
    trackEvent("login_started", { method: "google" })
    // Hands control to Google's OAuth screen; on return NextAuth resolves
    // the session and sends the user to callbackUrl. Errors come back as
    // ?error=google on /login and are rendered from search params above.
    await signIn("google", { callbackUrl })
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      <AuthShowcasePanel />
      <AuthMobileBanner />

      <main className="flex-1 flex items-center justify-center px-6 py-10 lg:py-12">
        <div className="w-full max-w-sm">
          {/* Mobile-only compact logo */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-sm">
              <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">Social Growth</span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to keep an eye on your competitors.</p>
          </div>

          <form
            key={shakeKey}
            onSubmit={onSubmit}
            className={`flex flex-col gap-4 ${error ? "auth-shake" : ""}`}
            noValidate
          >
            <button
              type="button"
              onClick={onGoogleClick}
              disabled={googleLoading || submitting}
              className="h-11 w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              ) : (
                <GoogleIcon className="h-[18px] w-[18px]" />
              )}
              Continue with Google
            </button>
            <p className="-mt-2 text-[11px] text-slate-400 leading-snug text-center">
              We only receive your name and email. No access to Gmail or other data.
            </p>

            <div className="relative flex items-center my-1">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">or</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`h-11 w-full pl-11 pr-4 rounded-lg border bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all ${
                    error ? "border-red-500" : "border-slate-200 focus:border-purple-500"
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  onClick={(e) => e.preventDefault()}
                  title="Coming soon"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`h-11 w-full pl-11 pr-11 rounded-lg border bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all ${
                    error ? "border-red-500" : "border-slate-200 focus:border-purple-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 -mt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || googleLoading}
              className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm shadow-sm shadow-purple-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-purple-600 hover:text-purple-700">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

async function fetchLoginMethod(email: string): Promise<"google" | "password" | "none"> {
  try {
    const res = await fetch("/api/auth/login-method", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) return "none"
    const body = (await res.json()) as { method?: "google" | "password" | "none" }
    return body.method ?? "none"
  } catch {
    return "none"
  }
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0012 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 001 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 002.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}
