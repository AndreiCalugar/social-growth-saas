import { describe, expect, it } from "vitest"
import {
  joinReplyVariants,
  parseReplyVariants,
  pickReplyVariant,
} from "./reply-variants"

describe("reply variants", () => {
  it("treats an existing single reply as one variation", () => {
    expect(parseReplyVariants("Ți-am trimis în DM! 📩")).toEqual(["Ți-am trimis în DM! 📩"])
    expect(parseReplyVariants(null)).toEqual([])
  })

  it("joins, trims, dedupes and caps at 5", () => {
    const stored = joinReplyVariants([" A ", "", "B", "A", "C", "D", "E", "F"])
    expect(parseReplyVariants(stored)).toEqual(["A", "B", "C", "D", "E"])
  })

  it("flattens newlines inside a variation", () => {
    expect(parseReplyVariants(joinReplyVariants(["line one\nline two"]))).toEqual([
      "line one line two",
    ])
  })

  it("picks across all variations", () => {
    const stored = joinReplyVariants(["A", "B", "C"])
    expect(pickReplyVariant(stored, () => 0)).toBe("A")
    expect(pickReplyVariant(stored, () => 0.5)).toBe("B")
    expect(pickReplyVariant(stored, () => 0.99)).toBe("C")
    expect(pickReplyVariant("", () => 0.5)).toBeNull()
  })
})
