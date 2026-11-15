import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({ supabase: {} }))

import { extractLinks, generateCode, isBotUserAgent, rewriteLinks } from "./link-tracking"

describe("extractLinks", () => {
  it("finds each distinct http(s) link once, in order", () => {
    const msg = "Uite: https://a.ro/x și https://b.com/y?z=1\nTot aici: https://a.ro/x"
    expect(extractLinks(msg)).toEqual(["https://a.ro/x", "https://b.com/y?z=1"])
  })

  it("drops punctuation that ends the sentence", () => {
    expect(extractLinks("Vezi https://site.ro/pagina.")).toEqual(["https://site.ro/pagina"])
    expect(extractLinks("(link: https://site.ro/a)!")).toEqual(["https://site.ro/a"])
  })

  it("ignores text without links", () => {
    expect(extractLinks("Salut! Scrie-mi în privat.")).toEqual([])
  })
})

describe("rewriteLinks", () => {
  it("swaps links for short links and keeps the rest of the text", () => {
    const msg = "Uite link-ul: https://site.ro/pagina.\nSpor!"
    const out = rewriteLinks(msg, new Map([["https://site.ro/pagina", "https://app.tech/r/abc12345"]]))
    expect(out).toBe("Uite link-ul: https://app.tech/r/abc12345.\nSpor!")
  })

  it("leaves links without a short link untouched", () => {
    const msg = "A: https://a.ro B: https://b.ro"
    const out = rewriteLinks(msg, new Map([["https://a.ro", "https://app.tech/r/aaaaaaaa"]]))
    expect(out).toBe("A: https://app.tech/r/aaaaaaaa B: https://b.ro")
  })
})

describe("generateCode", () => {
  it("makes 8-character codes the /r route accepts", () => {
    const codes = new Set(Array.from({ length: 200 }, generateCode))
    expect(codes.size).toBe(200)
    for (const code of codes) expect(code).toMatch(/^[A-Za-z0-9]{8}$/)
  })
})

describe("isBotUserAgent", () => {
  it("skips link-preview crawlers and bots", () => {
    expect(isBotUserAgent("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true)
    expect(isBotUserAgent("meta-externalagent/1.1")).toBe(true)
    expect(isBotUserAgent("WhatsApp/2.23")).toBe(true)
    expect(isBotUserAgent("Twitterbot/1.0")).toBe(true)
    expect(isBotUserAgent(null)).toBe(true)
  })

  it("counts real people, including in Instagram's in-app browser", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 360.0.0.30.109"
      )
    ).toBe(false)
    expect(isBotUserAgent("Mozilla/5.0 (Linux; Android 13; CUBOT X70) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe(false)
  })
})
