// Admin allowlist driven by env so we don't hardcode emails into the
// codebase. Set ADMIN_EMAILS=foo@example.com,bar@example.com in the
// environment for production. When empty (dev default), any
// authenticated user is treated as admin — useful while the app is
// solo / pre-launch but tighten this before onboarding real users.

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length === 0) return true // dev fallback
  return allowlist.includes(email.toLowerCase())
}
