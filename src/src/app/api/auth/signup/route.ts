import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as
    | { email?: string; password?: string; name?: string; signup_source?: string }
    | null

  const email = body?.email?.trim().toLowerCase()
  const password = body?.password
  const name = body?.name?.trim() || null
  // Trim to a sensible cap so a tampered URL can't stuff arbitrary
  // junk into the column; same limit as the captureUtmSource helper.
  const signup_source =
    typeof body?.signup_source === "string"
      ? body.signup_source.trim().slice(0, 64) || null
      : null

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const insertPayload: Record<string, unknown> = { email, password_hash, name }
  if (signup_source) insertPayload.signup_source = signup_source

  let { data, error } = await supabase
    .from("users")
    .insert(insertPayload)
    .select("id, email, name")
    .single()

  // Tolerate the column not yet existing (schema/013 not applied) so a
  // stale prod DB doesn't block signups while the migration is pending.
  if (error && (error.code === "42703" || error.message?.includes("signup_source"))) {
    delete insertPayload.signup_source
    const retry = await supabase
      .from("users")
      .insert(insertPayload)
      .select("id, email, name")
      .single()
    data = retry.data
    error = retry.error
  }

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, email: data.email, name: data.name })
}
