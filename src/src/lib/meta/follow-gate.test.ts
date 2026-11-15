import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({ supabase: {} }))

import { gateCopy, gateLanguage } from "./follow-gate"

describe("follow-gate copy", () => {
  it("speaks Romanian when the creator's DM is Romanian", () => {
    expect(gateLanguage("Uite link-ul promis: https://x.ro\nSpune-mi ce părere ai!")).toBe("ro")
    expect(gateLanguage("Here's the link you asked for: https://x.com")).toBe("en")
  })

  it("names the account to follow", () => {
    expect(gateCopy("ro", "andreixperience").followAsk).toContain("@andreixperience")
    expect(gateCopy("en", "andreixperience").followAsk).toContain("@andreixperience")
  })

  it("keeps button titles within Instagram's 20-character quick reply limit", () => {
    for (const lang of ["ro", "en"] as const) {
      const copy = gateCopy(lang, "x")
      expect(copy.openerButton.length).toBeLessThanOrEqual(20)
      expect(copy.followButton.length).toBeLessThanOrEqual(20)
    }
  })
})
