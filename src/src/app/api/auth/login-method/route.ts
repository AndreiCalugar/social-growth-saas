import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Helper the login page calls after a failed credentials sign-in to
// figure out whether the account exists at all and, if it does, whether
// it was registered through Google (no local password). The credentials
// provider can't communicate that distinction back to the client through
// signIn() — every failure surfaces as "CredentialsSignin" — so we ask
// here instead.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ method: "none" })

  const { data } = await supabase
    .from("users")
    .select("password_hash")
    .eq("email", email)
    .maybeSingle()

  if (!data) return NextResponse.json({ method: "none" })
  if (!data.password_hash) return NextResponse.json({ method: "google" })
  return NextResponse.json({ method: "password" })
}
