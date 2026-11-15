import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { isBotUserAgent } from "@/lib/link-tracking"
import { getBaseUrl } from "@/lib/meta/env"

// Short link from a tracked DM: count the click, then send the visitor on.
// Public on purpose (excluded in middleware.ts): the people clicking are
// the creator's followers, not app users.

const CODE_PATTERN = /^[A-Za-z0-9]{6,16}$/

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const home = NextResponse.redirect(getBaseUrl(), 302)
  if (!CODE_PATTERN.test(code)) return home

  let target: string | null = null
  if (isBotUserAgent(req.headers.get("user-agent"))) {
    // Link previews still need the real destination, but don't count.
    const { data } = await supabase.from("tracked_links").select("target_url").eq("code", code).maybeSingle()
    target = data?.target_url ?? null
  } else {
    const { data, error } = await supabase.rpc("register_link_click", { p_code: code })
    if (error) console.error("[r] click not counted", error.message)
    target = typeof data === "string" ? data : null
    if (!target && error) {
      // Counting failed (e.g. a DB hiccup): still get the visitor there.
      const { data: row } = await supabase.from("tracked_links").select("target_url").eq("code", code).maybeSingle()
      target = row?.target_url ?? null
    }
  }

  if (!target) return home
  const res = NextResponse.redirect(target, 302)
  res.headers.set("cache-control", "no-store")
  return res
}
