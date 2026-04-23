"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { User, Mail, Lock, Eye, EyeOff, Loader2, TrendingUp } from "lucide-react"
import { AuthShowcasePanel, AuthMobileBanner } from "@/components/auth-showcase-panel"

type Strength = { score: 0 | 1 | 2 | 3; label: string; color: string; bars: number }

function scorePassword(pw: string): Strength {
  if (pw.length === 0) return { score: 0, label: "", color: "bg-slate-200", bars: 0 }
  let points = 0
  if (pw.length >= 8) points++
  if (pw.length >= 12) points++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) points++
  if (/\d/.test(pw)) points++
  if (/[^A-Za-z0-9]/.test(pw)) points++

  if (pw.length < 8) return { score: 0, label: "Too short", color: "bg-red-500", bars: 1 }
  if (points <= 2) return { score: 1, label: "Weak", color: "bg-red-500", bars: 1 }
  if (points === 3) return { score: 2, label: "Okay", color: "bg-amber-500", bars: 2 }
  return { score: 3, label: "Strong", color: "bg-emerald-500", bars: 3 }
}

export default function SignupPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  const strength = useMemo(() => scorePassword(password), [password])

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      setShakeKey((k) => k + 1)
      return
    }

    setSubmitting(true)
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || "Could not create account.")
      setShakeKey((k) => k + 1)
      setSubmitting(false)
      return
    }

    const signInRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    })
    setSubmitting(false)

    if (!signInRes || signInRes.error) {
      setError("Account created but sign-in failed. Try logging in.")
      setShakeKey((k) => k + 1)
      return
    }
    router.push("/")
    router.refresh()
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Start growing today</h1>
            <p className="text-sm text-slate-500 mt-1">
              Create your free account — setup takes 2 minutes.
            </p>
          </div>

          <form
            key={shakeKey}
            onSubmit={onSubmit}
            className={`flex flex-col gap-4 ${error ? "auth-shake" : ""}`}
            noValidate
          >
            <FieldWithIcon
              id="name"
              label="Name"
              icon={User}
              type="text"
              autoComplete="name"
              value={name}
              onChange={setName}
              placeholder="Jane Doe"
              hasError={false}
            />

            <FieldWithIcon
              id="email"
              label="Email"
              icon={Mail}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              hasError={!!error}
            />

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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

              {/* Strength indicator */}
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.bars ? strength.color : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      strength.score === 3
                        ? "text-emerald-600"
                        : strength.score === 2
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 -mt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm shadow-sm shadow-purple-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </button>

            <div className="relative flex items-center my-1">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">or</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <button
              type="button"
              disabled
              title="Coming soon"
              className="h-11 w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white text-slate-400 font-medium text-sm cursor-not-allowed"
            >
              <GoogleIcon className="h-[18px] w-[18px] opacity-50" />
              Continue with Google
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">
                soon
              </span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-purple-600 hover:text-purple-700">
              Log in
            </Link>
          </p>

          <p className="mt-5 text-center text-xs text-slate-400 leading-relaxed">
            By creating an account you agree to our{" "}
            <span className="underline underline-offset-2 decoration-slate-300">Terms of Service</span>.
          </p>
        </div>
      </main>
    </div>
  )
}

function FieldWithIcon({
  id,
  label,
  icon: Icon,
  type,
  autoComplete,
  required,
  value,
  onChange,
  placeholder,
  hasError,
}: {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  type: string
  autoComplete?: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hasError: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 pointer-events-none" />
        <input
          id={id}
          type={type}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-11 w-full pl-11 pr-4 rounded-lg border bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all ${
            hasError ? "border-red-500" : "border-slate-200 focus:border-purple-500"
          }`}
        />
      </div>
    </div>
  )
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
