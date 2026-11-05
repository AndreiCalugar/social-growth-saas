import { Send } from "lucide-react"
import { BrandMark } from "@/components/brand-mark"

// Login / signup side panel. Stays in English while the Meta app review is
// running — reviewers sign in through this page.

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <span className={`text-sm font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Social Growth
      </span>
    </div>
  )
}

export function AuthShowcasePanel() {
  return (
    <aside className="relative isolate hidden overflow-hidden bg-ink text-white lg:flex lg:w-[55%] xl:w-[58%]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/login.jpg"
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_30%]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/75 to-ink/10" />

      <div className="relative z-10 flex w-full flex-col p-10 xl:p-14">
        <Wordmark light />

        <div className="flex max-w-xl flex-1 flex-col justify-end pb-10">
          <h2 className="text-3xl font-bold leading-[1.1] tracking-tight xl:text-[2.6rem]">
            Someone comments{" "}
            <span className="inline-block -rotate-2 rounded-2xl rounded-bl-md bg-brand px-3 pb-1">
              LINK
            </span>
            <br />
            They get your DM in seconds.
          </h2>

          {/* A comment and the DM it triggers */}
          <div className="mt-10 max-w-sm space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7c6cf0] text-xs font-bold">
                A
              </span>
              <div>
                <p className="text-[11px] text-white/50">andreea_m commented</p>
                <p className="mt-0.5 w-fit rounded-2xl rounded-bl-md bg-white/10 px-3 py-1.5 text-sm">
                  LINK 🙏
                </p>
              </div>
            </div>
            <div className="ml-10 flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand">
                <Send className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[11px] text-white/50">
                  Sent automatically · <span className="font-mono text-sent">0:16</span>
                </p>
                <p className="mt-0.5 rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm leading-snug text-ink">
                  Hey Andreea! 👋 Here&rsquo;s the guide I promised: yoursite.com/guide
                </p>
              </div>
            </div>
          </div>

          <p className="mt-10 text-[13px] text-white/60">
            Official Instagram API · No password sharing · Public reply under the
            comment, too
          </p>
        </div>

        <p className="text-[11px] tracking-wide text-white/50">
          Free during beta · No credit card required
        </p>
      </div>
    </aside>
  )
}

/** Condensed mobile banner shown above the form when the big panel is hidden. */
export function AuthMobileBanner() {
  return (
    <div className="w-full bg-ink text-white lg:hidden">
      <div className="mx-auto max-w-md px-6 py-6 text-center">
        <div className="mb-3 inline-flex">
          <Wordmark light />
        </div>
        <h2 className="text-base font-bold leading-snug">
          Comments become DMs, automatically
        </h2>
        <p className="mt-1 text-xs text-white/70">
          Someone comments your keyword — they get your message in seconds.
        </p>
      </div>
    </div>
  )
}
