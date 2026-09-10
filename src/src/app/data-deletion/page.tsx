import Link from "next/link"
import { LegalShell } from "@/components/legal/legal-shell"
import type { TocEntry } from "@/components/legal/legal-toc"

export const metadata = {
  title: "Data Deletion — Social Growth",
  description:
    "How to delete your Social Growth account data, including data obtained from Instagram.",
}

const TOC: TocEntry[] = [
  { id: "what-we-store", label: "1. What we store" },
  { id: "delete-in-app", label: "2. Delete from the app" },
  { id: "delete-by-email", label: "3. Delete by email" },
  { id: "instagram-data", label: "4. Instagram data" },
  { id: "timeline", label: "5. Deletion timeline" },
]

export default function DataDeletionPage() {
  return (
    <LegalShell
      title="Data Deletion Instructions"
      intro="You can delete your Social Growth account and all associated data — including any data obtained from your connected Instagram account — at any time. This page explains how."
      lastUpdated="September 2026"
      toc={TOC}
    >
      <section id="what-we-store">
        <h2>1. What we store</h2>
        <p>
          When you use Social Growth, we store your account details (name,
          email), the public Instagram profiles and posts you track, and — if
          you connect an Instagram account for DM automation — your Instagram
          account id, username, an encrypted access token, your automations,
          and a log of comments matched and direct messages sent on your
          behalf.
        </p>
      </section>

      <section id="delete-in-app">
        <h2>2. Delete from the app</h2>
        <p>To remove your Instagram data without deleting your account:</p>
        <ol>
          <li>
            Go to <strong>DM Automation</strong> in the dashboard and click{" "}
            <strong>Disconnect</strong> on your Instagram account. This deletes
            the stored access token and deactivates your automations.
          </li>
        </ol>
        <p>
          To delete your entire account and all associated data, use the
          account deletion option in <strong>Settings</strong>, or contact us
          by email (below).
        </p>
      </section>

      <section id="delete-by-email">
        <h2>3. Delete by email</h2>
        <p>
          Email{" "}
          <a href="mailto:hello@getsocialgrowth.tech">
            hello@getsocialgrowth.tech
          </a>{" "}
          from the address associated with your account with the subject{" "}
          <em>&quot;Delete my data&quot;</em>. We will delete your account and
          all associated data and confirm by reply.
        </p>
      </section>

      <section id="instagram-data">
        <h2>4. Instagram data</h2>
        <p>
          Disconnecting your Instagram account (or deleting your Social Growth
          account) permanently deletes the encrypted Instagram access token,
          your DM automations, and DM logs from our systems. You can also
          revoke Social Growth&apos;s access from Instagram itself:{" "}
          <em>
            Settings → Website permissions → Apps and websites
          </em>
          , which immediately invalidates the token on Meta&apos;s side.
        </p>
      </section>

      <section id="timeline">
        <h2>5. Deletion timeline</h2>
        <p>
          In-app deletions take effect immediately. Email requests are
          processed within 30 days (usually much sooner). Backups expire and
          are overwritten within 30 days of deletion.
        </p>
        <p>
          Questions? See our <Link href="/privacy">Privacy Policy</Link> or
          email us.
        </p>
      </section>
    </LegalShell>
  )
}
