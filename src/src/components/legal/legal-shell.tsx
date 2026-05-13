import { LandingHeader } from "@/components/landing/landing-header"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LegalToc, type TocEntry } from "@/components/legal/legal-toc"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"

export function LegalShell({
  title,
  intro,
  lastUpdated,
  toc,
  children,
}: {
  title: string
  intro?: string
  lastUpdated: string
  toc: TocEntry[]
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth">
      <LandingHeader />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
            Legal
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {intro && (
            <p className="mt-3 text-base text-slate-600 leading-relaxed">{intro}</p>
          )}
          <p className="mt-4 text-xs text-slate-400">Last updated: {lastUpdated}</p>
        </div>

        <div className="mt-12 grid lg:grid-cols-[1fr_220px] gap-10 lg:gap-14">
          <article className="legal-prose max-w-3xl">{children}</article>
          <aside className="hidden lg:block">
            <LegalToc entries={toc} />
          </aside>
        </div>
      </main>

      <LandingFooter />
      <CookieConsentBanner />
    </div>
  )
}
