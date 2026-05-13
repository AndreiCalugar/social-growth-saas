"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "What data do you need from me?",
    a: "Just your Instagram username. We only analyze public post data (likes, comments, captions). We never touch your DMs, stories, or private information.",
  },
  {
    q: "Is my data safe?",
    a: "We only scrape publicly available Instagram data. Your account credentials are never shared with us. We use industry-standard encryption and EU-compliant data storage.",
  },
  {
    q: "How is this different from Instagram Insights?",
    a: "Instagram Insights shows YOUR metrics. We analyze your COMPETITORS — what content formats work best across multiple accounts in your niche, then tell you exactly what to create.",
  },
  {
    q: "What niches does it work for?",
    a: "Any niche on Instagram — we've tested with bikepacking, coffee shops, music production, fitness, and more. The AI adapts to your specific niche automatically.",
  },
  {
    q: "How often should I run the analysis?",
    a: "We recommend monthly. Your competitors post new content, trends shift, and the AI detects fresh patterns each time.",
  },
  {
    q: "Is it really free?",
    a: "Yes, during beta. We'll introduce paid plans later with advanced features like weekly auto-refresh and video transcript analysis.",
  },
]

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="bg-white scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div className="text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-purple-600">
            FAQ
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Common questions
          </h2>
        </div>

        <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map(({ q, a }, i) => {
            const open = openIndex === i
            return (
              <div key={q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-base font-semibold text-slate-900">{q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 shrink-0 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-200 ease-out ${
                    open
                      ? "grid-rows-[1fr] opacity-100 pb-5"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm text-slate-600 leading-relaxed pr-8">{a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
