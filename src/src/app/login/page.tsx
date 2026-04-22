"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const search = useSearchParams()
  const callbackUrl = search.get("callbackUrl") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
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
      setError("Invalid email or password.")
      return
    }
    router.push(res.url || callbackUrl)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-sm">
            <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">Social Growth</span>
        </div>

        <Card className="p-6">
          <div className="mb-5">
            <h1 className="text-lg font-semibold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-0.5">Sign in to keep an eye on your competitors.</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-700">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition"
                placeholder="you@example.com"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-700">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="mt-1">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-purple-600 hover:text-purple-700">
              Create an account
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
