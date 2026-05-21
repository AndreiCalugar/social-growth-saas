import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcrypt"
import { cookies } from "next/headers"
import { getServerSession } from "next-auth"
import { supabase } from "@/lib/supabase"

// Surfaced to the login page so it can render a "this account uses Google
// sign-in" hint instead of the generic "wrong password" message.
export const GOOGLE_ONLY_ERROR = "GoogleOnly"

// Short-lived cookie the signup page writes before kicking off the Google
// OAuth handshake so the server-side signIn callback can stamp the new
// user row with the utm source. Kept in sync with the client helper.
export const UTM_SOURCE_COOKIE = "sg.utm_source"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        if (!email || !password) return null

        const { data: user } = await supabase
          .from("users")
          .select("id, email, name, password_hash")
          .eq("email", email)
          .maybeSingle()

        if (!user) return null
        // Account exists but was created via Google — no local password to
        // check. Throw a specific error so the login page can prompt the
        // user to switch to the Google button.
        if (!user.password_hash) {
          throw new Error(GOOGLE_ONLY_ERROR)
        }
        const ok = await bcrypt.compare(password, user.password_hash)
        if (!ok) return null

        return { id: user.id, email: user.email, name: user.name ?? null }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true

      const email = user.email?.trim().toLowerCase()
      if (!email) return false

      const { data: existing } = await supabase
        .from("users")
        .select("id, name")
        .eq("email", email)
        .maybeSingle()

      if (existing) {
        // Account already exists (email/password or prior Google sign-in).
        // Reuse its id so the JWT and Supabase rows stay aligned — no
        // duplicate row, account is effectively linked.
        user.id = existing.id
        return true
      }

      // First-time Google sign-in. Capture utm_source if the signup page
      // dropped one in a cookie before the OAuth redirect.
      let signupSource: string | null = null
      try {
        const cookieStore = await cookies()
        signupSource = cookieStore.get(UTM_SOURCE_COOKIE)?.value?.slice(0, 64) || null
      } catch {
        signupSource = null
      }

      const insertPayload: Record<string, unknown> = {
        email,
        name: user.name ?? null,
        password_hash: null,
      }
      if (signupSource) insertPayload.signup_source = signupSource

      let { data, error } = await supabase
        .from("users")
        .insert(insertPayload)
        .select("id")
        .single()

      // Tolerate prod DBs that haven't yet run schema/013 (signup_source)
      // or schema/015 (nullable password_hash) — mirrors the same fallback
      // the email signup route uses.
      if (
        error &&
        (error.code === "42703" || error.message?.includes("signup_source"))
      ) {
        delete insertPayload.signup_source
        const retry = await supabase
          .from("users")
          .insert(insertPayload)
          .select("id")
          .single()
        data = retry.data
        error = retry.error
      }

      if (error || !data) {
        console.error("[auth] failed to create Google user:", error)
        return false
      }

      user.id = data.id
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name ?? null
        token.email = user.email ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export function auth() {
  return getServerSession(authOptions)
}
