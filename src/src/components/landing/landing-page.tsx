"use client"

import { LandingHeader } from "./landing-header"
import { LandingHero } from "./landing-hero"
import { LandingSocialProof } from "./landing-social-proof"
import { LandingHowItWorks } from "./landing-how-it-works"
import { LandingFeatures } from "./landing-features"
import { LandingExample } from "./landing-example"
import { LandingPricing } from "./landing-pricing"
import { LandingFaq } from "./landing-faq"
import { LandingFooter } from "./landing-footer"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingSocialProof />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingExample />
        <LandingPricing />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  )
}
