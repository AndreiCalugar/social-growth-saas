import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Social Growth",
  description: "AI-powered Instagram analytics",
}

export const dynamic = "force-dynamic"

// GA4 is loaded per-segment, not globally:
//   - (app)/layout.tsx        → always loads for authenticated users
//   - login + signup layouts  → always loads (conversion events fire here)
//   - landing + legal pages   → loaded only after the cookie banner accepts
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
