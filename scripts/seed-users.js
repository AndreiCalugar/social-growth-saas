#!/usr/bin/env node
/**
 * Seed two test users and migrate existing profiles to them.
 *
 *   andrei@test.com / password123   — owns ALL existing data (including
 *                                     competitors already scraped)
 *   irina@test.com  / password123   — fresh tenant, owns irina.narativa only
 *
 * Prereqs:
 *   1. schema/004-users-auth.sql has been run against Supabase
 *   2. .env.local is populated with NEXT_PUBLIC_SUPABASE_URL and
 *      SUPABASE_SECRET_KEY
 *   3. `npm install bcrypt @supabase/supabase-js dotenv` in src/
 *
 * Run from repo root:
 *   node scripts/seed-users.js
 *
 * Idempotent: safe to re-run. Existing users are updated (not duplicated),
 * existing profiles get their user_id backfilled.
 */

const path = require("path")
const { createClient } = require(path.join(__dirname, "..", "src", "node_modules", "@supabase", "supabase-js"))
const bcrypt = require(path.join(__dirname, "..", "src", "node_modules", "bcrypt"))
require(path.join(__dirname, "..", "src", "node_modules", "dotenv")).config({
  path: path.join(__dirname, "..", "src", ".env.local"),
})

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in src/.env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const USERS = [
  { email: "andrei@test.com", name: "Andrei", password: "password123" },
  { email: "irina@test.com", name: "Irina", password: "password123" },
]

async function upsertUser({ email, name, password }) {
  const password_hash = await bcrypt.hash(password, 10)
  const { data: existing } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", email)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({ password_hash, name })
      .eq("id", existing.id)
    if (error) throw error
    console.log(`  updated ${email}`)
    return existing.id
  }

  const { data, error } = await supabase
    .from("users")
    .insert({ email, name, password_hash })
    .select("id")
    .single()
  if (error) throw error
  console.log(`  created ${email}`)
  return data.id
}

async function main() {
  console.log("Seeding users…")
  const [andreiId, irinaId] = await Promise.all(USERS.map(upsertUser))

  console.log("\nBackfilling existing profiles to andrei…")
  const { data: unassigned, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, username, is_own")
    .is("user_id", null)
  if (profilesErr) throw profilesErr

  if (unassigned && unassigned.length > 0) {
    const ids = unassigned.map((p) => p.id)
    const { error } = await supabase
      .from("profiles")
      .update({ user_id: andreiId })
      .in("id", ids)
    if (error) throw error
    console.log(`  assigned ${ids.length} profile(s) to andrei`)
  } else {
    console.log("  (none to backfill)")
  }

  console.log("\nSetting up irina's tenant…")
  // Find the existing irina.narativa row (currently owned by andrei).
  const { data: irinaProfile } = await supabase
    .from("profiles")
    .select("id, username, user_id, is_own")
    .eq("username", "irina.narativa")
    .maybeSingle()

  if (!irinaProfile) {
    console.log("  irina.narativa profile not found — skipping reassignment")
  } else {
    // Hand irina.narativa to irina@test.com as her own profile.
    const { error: moveErr } = await supabase
      .from("profiles")
      .update({ user_id: irinaId, is_own: true })
      .eq("id", irinaProfile.id)
    if (moveErr) throw moveErr
    console.log(`  reassigned @irina.narativa -> irina@test.com (is_own=true)`)

    // If that profile had posts/scrape_runs, they follow via profile_id FK.
    // No further work needed for child rows.

    // Make sure andrei still has exactly one is_own profile.
    const { data: andreiOwn } = await supabase
      .from("profiles")
      .select("id, username, is_own")
      .eq("user_id", andreiId)
      .eq("is_own", true)

    if (!andreiOwn || andreiOwn.length === 0) {
      // Promote andreixperience if present, otherwise leave unset.
      const { data: andreiMain } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", andreiId)
        .eq("username", "andreixperience")
        .maybeSingle()
      if (andreiMain) {
        await supabase
          .from("profiles")
          .update({ is_own: true })
          .eq("id", andreiMain.id)
        console.log("  promoted @andreixperience as andrei's own profile")
      } else {
        console.log("  ⚠️  andrei has no is_own profile; pick one from /profiles after login")
      }
    } else if (andreiOwn.length > 1) {
      // Keep only the first is_own — flip the rest off.
      const keep = andreiOwn[0].id
      const drop = andreiOwn.filter((p) => p.id !== keep).map((p) => p.id)
      await supabase.from("profiles").update({ is_own: false }).in("id", drop)
      console.log(`  normalized andrei to a single is_own profile (kept ${andreiOwn[0].username})`)
    }
  }

  console.log("\nDone. Test accounts:")
  console.log("  andrei@test.com / password123  (all existing data)")
  console.log("  irina@test.com  / password123  (owns @irina.narativa)")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
