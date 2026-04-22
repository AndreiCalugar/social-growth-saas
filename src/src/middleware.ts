import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: { signIn: "/login" },
})

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - /login, /signup
     * - /api/auth (NextAuth routes)
     * - Next internals (_next, favicon, etc.)
     */
    "/((?!login|signup|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
