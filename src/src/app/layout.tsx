import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { supabase } from "@/lib/supabase"

const geist = Geist({ subsets: ["latin"] })

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
      <body className={`${geist.className} h-screen overflow-hidden`}>
        <div className="flex h-full">
          <Sidebar username={ownProfile?.username ?? "—"} />
          <main className="flex-1 overflow-y-auto bg-muted/20">{children}</main>
        </div>
      </body>
    </html>
  )
}
