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
     * - Next internals (_next, favicon, etc.)
     */
    "/((?!login|signup|privacy|terms|cookies|api/auth|_next/static|_next/image|favicon.ico|$).*)",
  ],
}
