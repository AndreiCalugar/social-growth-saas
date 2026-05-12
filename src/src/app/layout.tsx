import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { GA4Script } from "@/components/ga4-script"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Social Growth",
  description: "AI-powered Instagram analytics",
}

export const dynamic = "force-dynamic"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 antialiased`}>
        <GA4Script />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
