import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { supabase } from "@/lib/supabase"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Social Growth",
  description: "AI-powered Instagram & TikTok analytics",
}

export const dynamic = "force-dynamic"

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("is_own", true)
    .single()

  return (
    <html lang="en">
      <body className={`${inter.className} h-screen overflow-hidden bg-slate-50 antialiased`}>
        <div className="flex h-full">
          <Sidebar username={ownProfile?.username ?? "—"} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  )
}
