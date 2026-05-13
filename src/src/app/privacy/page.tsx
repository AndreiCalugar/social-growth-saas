import Link from "next/link"
import { LegalShell } from "@/components/legal/legal-shell"
import type { TocEntry } from "@/components/legal/legal-toc"

export const metadata = {
  title: "Privacy Policy — Social Growth",
  description: "How Social Growth collects, uses, and protects your data.",
}

const TOC: TocEntry[] = [
  { id: "controller", label: "1. Data controller" },
  { id: "data-collected", label: "2. Data we collect" },
  { id: "purpose", label: "3. How we use it" },
  { id: "third-parties", label: "4. Third-party processors" },
  { id: "retention", label: "5. Data retention" },
  { id: "rights", label: "6. Your GDPR rights" },
  { id: "exercise", label: "7. Exercising your rights" },
  { id: "cookies", label: "8. Cookies" },
  { id: "changes", label: "9. Changes" },
]

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      intro="This policy explains what personal data Social Growth collects, why, and what rights you have over it under the EU General Data Protection Regulation (GDPR)."
      lastUpdated="May 2026"
      toc={TOC}
    >
      <section id="controller">
        <h2>1. Data controller</h2>
        <p>
          The data controller responsible for your personal data under this
          policy is:
        </p>
        <p>
          <strong>Andrei Călugăr</strong>
          <br />
          Cluj-Napoca, Romania
          <br />
          Email:{" "}
          <a href="mailto:andrei.nicolae.calugar@gmail.com">
            andrei.nicolae.calugar@gmail.com
          </a>
        </p>
        <p>
          Social Growth is operated as a sole proprietorship by the data
          controller named above. All questions about your data should be sent
          to that email.
        </p>
      </section>

      <section id="data-collected">
        <h2>2. Data we collect</h2>
        <p>We collect only the data we need to run the service:</p>
        <ul>
          <li>
            <strong>Account data:</strong> your email address, your name
            (optional), and a hashed password. We never store your password in
            plaintext.
          </li>
          <li>
            <strong>Instagram public data:</strong> public information about
            the Instagram profiles you ask us to analyze — posts, captions,
            like counts, comment counts, posting timestamps, and the public
            profile metadata. We do not access DMs, stories, or any
            authenticated-only data.
          </li>
          <li>
            <strong>Product analytics:</strong> anonymized usage data (pages
            visited, actions taken) used to understand and improve the product.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> ask for your Instagram password. We do
          <strong> not</strong> access your Instagram account on your behalf.
        </p>
      </section>

      <section id="purpose">
        <h2>3. How we use it</h2>
        <p>We use your data only for the purposes you would expect:</p>
        <ul>
          <li>To create and run your Social Growth account.</li>
          <li>
            To scrape and analyze the Instagram profiles you add to your
            workspace, and to generate content recommendations.
          </li>
          <li>To send service emails (e.g. password resets, important changes).</li>
          <li>To understand product usage and fix bugs.</li>
        </ul>
        <p>We do not sell your data. We do not share it with advertisers.</p>
      </section>

      <section id="third-parties">
        <h2>4. Third-party processors</h2>
        <p>
          We use a small number of third-party processors to run the service.
          Each one only receives the minimum data it needs to do its job:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — PostgreSQL database hosting (EU
            region). Stores your account data and the scraped Instagram data.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting (EU region). Serves
            the web app and handles request logs.
          </li>
          <li>
            <strong>Apify</strong> — Instagram public-data scraping. Receives
            the usernames you ask us to analyze.
          </li>
          <li>
            <strong>Anthropic (Claude API)</strong> — AI analysis of the
            scraped posts. Receives caption text and aggregate metrics, never
            your account credentials.
          </li>
          <li>
            <strong>Google Analytics (GA4)</strong> — anonymized website
            analytics. Only loads if you accept analytics cookies.
          </li>
        </ul>
      </section>

      <section id="retention">
        <h2>5. Data retention</h2>
        <p>
          We keep your data for as long as your account is active. If you
          delete your account, we permanently delete your personal data
          (account record, profiles you added, scraped posts, generated
          insights) within 30 days.
        </p>
        <p>
          Some data may be retained beyond that period only where required by
          law (for example, to comply with tax record-keeping).
        </p>
      </section>

      <section id="rights">
        <h2>6. Your GDPR rights</h2>
        <p>
          Because we&apos;re an EU operator, every user — wherever you live —
          gets the full set of GDPR rights:
        </p>
        <ul>
          <li>
            <strong>Access</strong> — request a copy of the personal data we
            hold about you.
          </li>
          <li>
            <strong>Rectification</strong> — ask us to correct anything that&apos;s
            wrong.
          </li>
          <li>
            <strong>Erasure</strong> — ask us to delete your data (the &quot;right
            to be forgotten&quot;).
          </li>
          <li>
            <strong>Portability</strong> — get a machine-readable copy of your
            data to take elsewhere.
          </li>
          <li>
            <strong>Restriction</strong> — ask us to stop processing your data
            in certain situations.
          </li>
          <li>
            <strong>Objection</strong> — object to processing based on our
            legitimate interests.
          </li>
        </ul>
        <p>
          You can also lodge a complaint with your local data protection
          authority. In Romania that&apos;s the{" "}
          <a
            href="https://www.dataprotection.ro/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ANSPDCP
          </a>
          .
        </p>
      </section>

      <section id="exercise">
        <h2>7. Exercising your rights</h2>
        <p>You can exercise any of these rights in two ways:</p>
        <ul>
          <li>
            Email{" "}
            <a href="mailto:andrei.nicolae.calugar@gmail.com">
              andrei.nicolae.calugar@gmail.com
            </a>{" "}
            from the address on your account.
          </li>
          <li>
            Delete your account directly from{" "}
            <Link href="/settings">Settings</Link> — this triggers full erasure
            within 30 days.
          </li>
        </ul>
        <p>
          We&apos;ll respond to all requests within 30 days. There&apos;s no
          fee for reasonable requests.
        </p>
      </section>

      <section id="cookies">
        <h2>8. Cookies</h2>
        <p>We use only two categories of cookies:</p>
        <ul>
          <li>
            <strong>Essential session cookies</strong> — set by NextAuth so we
            can keep you logged in. These can&apos;t be disabled without
            breaking the app.
          </li>
          <li>
            <strong>Analytics cookies</strong> — Google Analytics 4 (GA4),
            used to understand how the public website is used. We only load
            these if you click <strong>Accept</strong> on the cookie banner.
          </li>
        </ul>
        <p>
          See our <Link href="/cookies">Cookie Policy</Link> for the full
          breakdown.
        </p>
      </section>

      <section id="changes">
        <h2>9. Changes to this policy</h2>
        <p>
          If we change this policy in a way that materially affects you, we&apos;ll
          email you and update the &quot;Last updated&quot; date above. Minor
          clarifications won&apos;t trigger a notification.
        </p>
      </section>
    </LegalShell>
  )
}
