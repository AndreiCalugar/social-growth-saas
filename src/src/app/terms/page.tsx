import Link from "next/link"
import { LegalShell } from "@/components/legal/legal-shell"
import type { TocEntry } from "@/components/legal/legal-toc"

export const metadata = {
  title: "Terms of Service — Social Growth",
  description: "The terms under which you can use Social Growth.",
}

const TOC: TocEntry[] = [
  { id: "service", label: "1. The service" },
  { id: "account", label: "2. Your account" },
  { id: "acceptable-use", label: "3. Acceptable use" },
  { id: "ip", label: "4. Intellectual property" },
  { id: "liability", label: "5. Limitation of liability" },
  { id: "changes", label: "6. Changes to the service" },
  { id: "termination", label: "7. Termination" },
  { id: "law", label: "8. Governing law" },
  { id: "contact", label: "9. Contact" },
]

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      intro="These terms describe what Social Growth is, what you can do with it, and what each of us is responsible for. By creating an account you agree to them."
      lastUpdated="May 2026"
      toc={TOC}
    >
      <section id="service">
        <h2>1. The service</h2>
        <p>
          Social Growth (&quot;we&quot;, &quot;us&quot;) is an AI-powered Instagram
          content strategy tool. We scrape public Instagram data for the
          profiles you add, analyze it with large language models, and surface
          patterns and content briefs to help you grow.
        </p>
        <p>
          The service is currently in <strong>beta</strong>. Features may
          change, break, or be removed. We&apos;ll do our best to give notice
          when something material changes, but we can&apos;t guarantee uptime
          or feature stability during this phase.
        </p>
      </section>

      <section id="account">
        <h2>2. Your account</h2>
        <p>
          To use Social Growth you need an account. When you sign up, you
          agree that:
        </p>
        <ul>
          <li>The information you provide is accurate.</li>
          <li>You&apos;ll keep your password confidential.</li>
          <li>
            You&apos;re responsible for everything that happens under your
            account, including any competitors or content briefs you create.
          </li>
          <li>
            You&apos;re at least 16 years old (or the digital consent age in
            your country, whichever is higher).
          </li>
        </ul>
        <p>
          You can delete your account at any time from{" "}
          <Link href="/settings">Settings</Link>. We&apos;ll erase your data
          within 30 days as described in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section id="acceptable-use">
        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            Use the service to scrape Instagram profiles in volumes that
            violate Instagram&apos;s own Terms of Service.
          </li>
          <li>
            Use automated scripts, bots, or other tools to access the service
            outside of the intended UI.
          </li>
          <li>
            Reverse engineer, decompile, or attempt to extract our source
            code, prompts, or AI models.
          </li>
          <li>
            Use the service to harass, impersonate, or defame anyone, or to
            target private individuals (it&apos;s designed for analyzing
            public creator/brand accounts).
          </li>
          <li>
            Resell access to the service or wrap it in your own product
            without a written agreement.
          </li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate these rules. We&apos;ll
          give you a chance to fix the issue first unless the violation is
          serious enough that we need to act immediately.
        </p>
      </section>

      <section id="ip">
        <h2>4. Intellectual property</h2>
        <p>
          <strong>You own your data.</strong> Anything you upload, configure,
          or generate inside the app (the profiles you add, your saved briefs,
          your notes) belongs to you. By using the service you grant us a
          limited, non-exclusive license to process that data only as needed
          to run the service for you.
        </p>
        <p>
          <strong>We own the platform.</strong> The Social Growth web app,
          back-end pipelines, prompts, and underlying models we&apos;ve built
          are ours. The AI-generated outputs you receive are yours to use
          freely — but the underlying machinery that produces them isn&apos;t
          part of that license.
        </p>
        <p>
          Public Instagram data we surface remains the property of its
          respective owners. We surface it under fair-use/research grounds.
          You&apos;re responsible for how you use any content you draw
          inspiration from.
        </p>
      </section>

      <section id="liability">
        <h2>5. Limitation of liability</h2>
        <p>
          Social Growth provides content <strong>recommendations</strong>, not
          guarantees. Whether a brief actually grows your audience depends on
          execution, niche, timing, and a hundred other things we don&apos;t
          control. We don&apos;t promise specific outcomes (followers, reach,
          revenue), and we&apos;re not liable for business decisions you make
          based on our suggestions.
        </p>
        <p>
          To the maximum extent allowed by law, we&apos;re not liable for any
          indirect, incidental, consequential, or special damages arising from
          your use of the service. Our total liability for any direct damages
          is capped at the amount you&apos;ve paid us in the previous 12
          months (which, during the free beta, is €0).
        </p>
        <p>
          The service is provided &quot;as is&quot; and &quot;as
          available&quot;, without warranties of any kind beyond those that
          can&apos;t be excluded by law.
        </p>
      </section>

      <section id="changes">
        <h2>6. Changes to the service</h2>
        <p>
          We may add, change, or remove features at any time, and we may
          introduce paid plans in the future. If we introduce pricing for a
          feature you currently use, we&apos;ll give you reasonable advance
          notice (at least 30 days) and a chance to opt out before any charge.
        </p>
        <p>
          We may also update these Terms. Material changes will be announced
          by email or via an in-app notice. Continued use of the service after
          the change means you accept the new terms.
        </p>
      </section>

      <section id="termination">
        <h2>7. Termination</h2>
        <p>Either side can end this agreement at any time:</p>
        <ul>
          <li>
            <strong>You</strong> can delete your account from{" "}
            <Link href="/settings">Settings</Link> or by emailing us.
          </li>
          <li>
            <strong>We</strong> can suspend or terminate accounts that violate
            these Terms, or stop the service entirely (with at least 30 days
            notice unless safety or legal reasons require faster action).
          </li>
        </ul>
        <p>
          On termination we&apos;ll delete your data per our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section id="law">
        <h2>8. Governing law</h2>
        <p>
          These Terms are governed by the laws of Romania and the European
          Union. Any disputes that can&apos;t be resolved informally will fall
          under the exclusive jurisdiction of the courts of Cluj-Napoca,
          Romania, unless your local consumer-protection law requires
          otherwise.
        </p>
      </section>

      <section id="contact">
        <h2>9. Contact</h2>
        <p>
          Questions, complaints, or legal notices go to:{" "}
          <a href="mailto:andrei.nicolae.calugar@gmail.com">
            andrei.nicolae.calugar@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalShell>
  )
}
