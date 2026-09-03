import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: { signIn: "/login" },
})

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - / (public landing — handled in the page itself)
     * - /login, /signup
     * - /privacy, /terms, /cookies (public legal pages)
     * - /api/auth (NextAuth routes)
     * - /api/instagram/webhook (Meta calls it — verified by X-Hub-Signature-256, not a session)
     * - /api/cron (system cron calls it — verified by CRON_SECRET bearer token)
     * - Next internals (_next, favicon, etc.)
     */
    "/((?!login|signup|privacy|terms|cookies|api/auth|api/instagram/webhook|api/cron|_next/static|_next/image|favicon.ico|$).*)",
  ],
}
