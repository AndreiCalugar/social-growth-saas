// Who can open /admin. No server imports here so client components (the
// sidebar) can use it too.
export const ADMIN_EMAILS = ["andrei.nicolae.calugar@gmail.com"]

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
