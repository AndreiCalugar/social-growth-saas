import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { LandingPage } from "@/components/landing/landing-page"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Social Growth — Turn competitor data into your content strategy",
  description:
    "We analyze your competitors' top Instagram posts and tell you exactly what to create — with hooks, caption structure, hashtags, and the best time to post.",
}

export default async function HomePage() {
  const session = await auth()
  if (session?.user?.id) {
    redirect("/overview")
  }

  return (
    <>
      <LandingPage />
      <CookieConsentBanner />
    </>
  )
}
