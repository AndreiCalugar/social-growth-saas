import Link from "next/link"
import { LegalShell } from "@/components/legal/legal-shell"
import type { TocEntry } from "@/components/legal/legal-toc"

export const metadata = {
  title: "Cookie Policy — Social Growth",
  description: "Which cookies Social Growth uses and how to control them.",
}

const TOC: TocEntry[] = [
  { id: "what", label: "1. What are cookies?" },
  { id: "essential", label: "2. Essential cookies" },
  { id: "analytics", label: "3. Analytics cookies" },
  { id: "control", label: "4. How to control them" },
  { id: "changes", label: "5. Changes" },
]

export default function CookiesPage() {
  return (
    <LegalShell
      title="Cookie Policy"
      intro="A short, plain-English explanation of every cookie we set and how to turn them off."
      lastUpdated="May 2026"
      toc={TOC}
    >
      <section id="what">
        <h2>1. What are cookies?</h2>
        <p>
          Cookies are small pieces of data a website saves in your browser.
          Some are required for a site to work (like remembering you&apos;re
          logged in). Others are optional and used for things like analytics.
        </p>
        <p>
          We use exactly two categories, described below.
        </p>
      </section>

      <section id="essential">
        <h2>2. Essential cookies</h2>
        <p>
          Required for the app to function. These can&apos;t be disabled
          without breaking core features like login.
        </p>
        <ul>
          <li>
            <strong>NextAuth session cookies</strong> — set when you log in so
            we can keep you signed in across page loads. Deleted when you log
            out.
          </li>
        </ul>
        <p>
          Essential cookies don&apos;t require consent under GDPR because they
          provide a service you explicitly asked for (being logged in).
        </p>
      </section>

      <section id="analytics">
        <h2>3. Analytics cookies</h2>
        <p>
          Optional. We use <strong>Google Analytics 4 (GA4)</strong> to
          understand which pages on the public website are useful and where
          users drop off. We only load GA4 if you click <strong>Accept</strong>
          {" "}on the cookie banner — declining keeps the script from loading
          at all.
        </p>
        <p>
          GA4 sets a small number of cookies (typically{" "}
          <code>_ga</code> and <code>_ga_*</code>) that store an anonymized
          client ID. We do not pass personal data (name, email, address) into
          GA4.
        </p>
        <p>
          Google&apos;s own data practices are described here:{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            policies.google.com/privacy
          </a>
          .
        </p>
      </section>

      <section id="control">
        <h2>4. How to control cookies</h2>
        <ul>
          <li>
            <strong>The banner.</strong> The first time you visit, you&apos;ll
            see a banner with <strong>Accept</strong> and{" "}
            <strong>Decline</strong> buttons. Declining stops the GA4 script
            from loading.
          </li>
          <li>
            <strong>Reset your choice.</strong> Clearing site data for{" "}
            <code>social-growth.app</code> in your browser (or just removing
            the <code>sg.cookie_consent</code> entry from localStorage) will
            make the banner show again.
          </li>
          <li>
            <strong>Browser settings.</strong> Every modern browser lets you
            block all third-party cookies, or block specific domains. That
            also works.
          </li>
        </ul>
      </section>

      <section id="changes">
        <h2>5. Changes</h2>
        <p>
          If we add a new category of cookie (for example, a customer-support
          chat widget), we&apos;ll list it here and re-prompt for consent. See
          our <Link href="/privacy">Privacy Policy</Link> for the broader
          picture on data handling.
        </p>
      </section>
    </LegalShell>
  )
}
