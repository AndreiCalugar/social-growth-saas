import Link from "next/link"
import { TrendingUp } from "lucide-react"

export function LandingFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-2 max-w-sm">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-sm">
                <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-white tracking-tight">Social Growth</span>
            </Link>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              AI-powered content strategy for creators. Turn competitor data
              into briefs you can actually film.
            </p>
            <p className="mt-6 text-xs text-slate-500">
              © {new Date().getFullYear()} Social Growth. All rights reserved.
            </p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { href: "/#features", label: "Features" },
              { href: "/#pricing", label: "Pricing" },
              { href: "/#faq", label: "FAQ" },
            ]}
          />

          <FooterColumn
            title="Legal"
            links={[
              { href: "/privacy", label: "Privacy Policy" },
              { href: "/terms", label: "Terms of Service" },
              { href: "/cookies", label: "Cookie Policy" },
            ]}
          />
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <ExternalLink href="https://instagram.com/andreixperience">Instagram</ExternalLink>
            <ExternalLink href="https://www.linkedin.com/in/andreicalugar/">LinkedIn</ExternalLink>
            <ExternalLink href="https://substack.com/@andreixperience">Substack</ExternalLink>
          </div>
          <p className="text-xs text-slate-500">
            Made in Romania <span aria-hidden>🇷🇴</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: Array<{ href: string; label: string }>
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-slate-400 hover:text-white transition-colors"
    >
      {children}
    </a>
  )
}
