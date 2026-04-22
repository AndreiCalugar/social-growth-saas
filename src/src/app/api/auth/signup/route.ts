import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { supabase } from "@/lib/supabase"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as
    | { email?: string; password?: string; name?: string }
    | null

  const email = body?.email?.trim().toLowerCase()
  const password = body?.password
  const name = body?.name?.trim() || null

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

  const { data, error } = await supabase
    .from("users")
    .insert({ email, password_hash, name })
    .select("id, email, name")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, email: data.email, name: data.name })
}
