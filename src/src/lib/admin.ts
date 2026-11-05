// Who counts as admin (/admin feedback view, /admin/beta, beta-gate bypass).
//
// ADMIN_EMAILS=foo@example.com,bar@example.com in the environment adds
// admins on the server. The owner's address is always included, and there is
// no "everyone is admin" fallback: admins skip the beta gate, so an unset
// env var must not open it up. Client components (the sidebar) don't see the
// server env and only know the owner — fine for showing a nav link, since
// every admin page and API re-checks on the server.

const OWNER_EMAILS = ["andrei.nicolae.calugar@gmail.com"]

function adminEmails(): string[] {
  const fromEnv =
    typeof process !== "undefined" ? (process.env.ADMIN_EMAILS ?? "") : ""
  return [
    ...OWNER_EMAILS,
    ...fromEnv
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ]
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase())
}
