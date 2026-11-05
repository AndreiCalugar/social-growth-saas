import { redirect } from "next/navigation"
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google"
import { auth } from "@/lib/auth"
import { LandingRo } from "@/components/landing-ro/landing-ro"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"

export const dynamic = "force-dynamic"

// latin-ext carries the Romanian diacritics (ă, â, î, ș, ț).
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
})
const body = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument",
})
const stamp = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
})

export const metadata = {
  title: "Social Growth — Comentariile de pe Instagram primesc răspuns automat în DM",
  description:
    "Cineva comentează „LINK” și primește linkul în DM, în câteva secunde. Răspunsuri automate la comentariile de pe Instagram, în română, prin API-ul oficial Meta.",
}

export default async function HomePage() {
  const session = await auth()
  if (session?.user?.id) {
    redirect("/dms")
  }

  return (
    <div lang="ro" className={`${display.variable} ${body.variable} ${stamp.variable}`}>
      <LandingRo />
      <CookieConsentBanner />
    </div>
  )
}
