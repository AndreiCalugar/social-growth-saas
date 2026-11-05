import { describe, expect, it, vi } from "vitest"

// beta.ts imports the Supabase client; the pure helpers don't need it.
vi.mock("@/lib/supabase", () => ({ supabase: {} }))

import { normalizeInstagramUsername } from "./beta"
import { isAdminEmail } from "./admin"

describe("normalizeInstagramUsername", () => {
  it("accepts plain handles and lowercases them", () => {
    expect(normalizeInstagramUsername("Irina.Narativa")).toBe("irina.narativa")
  })

  it("strips @, spaces and profile URLs", () => {
    expect(normalizeInstagramUsername("  @my_brand ")).toBe("my_brand")
    expect(normalizeInstagramUsername("https://www.instagram.com/my_brand/")).toBe("my_brand")
    expect(normalizeInstagramUsername("instagram.com/my_brand?igsh=abc")).toBe("my_brand")
  })

  it("rejects invalid handles", () => {
    expect(normalizeInstagramUsername("")).toBeNull()
    expect(normalizeInstagramUsername("has space")).toBeNull()
    expect(normalizeInstagramUsername("a".repeat(31))).toBeNull()
  })
})

describe("isAdminEmail", () => {
  it("matches the admin email case-insensitively", () => {
    expect(isAdminEmail("Andrei.Nicolae.Calugar@gmail.com")).toBe(true)
    expect(isAdminEmail("someone@gmail.com")).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
  })
})
