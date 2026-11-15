import { afterEach, describe, expect, it, vi } from "vitest"
import Anthropic from "@anthropic-ai/sdk"
import {
  detectLanguage,
  disclosureLine,
  generateAssistantReply,
  handoffMessage,
  setAnthropicClientForTests,
  type AssistantInput,
} from "./assistant"

const input: AssistantInput = {
  creatorUsername: "ana.picteaza",
  knowledge: "Atelier de pictură. Preț: 250 lei.",
  tone: "warm",
  history: [],
  question: "Cât costă?",
}

function fakeClient(response: unknown) {
  const create = vi.fn().mockImplementation(async () => {
    if (response instanceof Error) throw response
    return response
  })
  setAnthropicClientForTests({ messages: { create } } as unknown as Anthropic)
  return create
}

const message = (json: object, stop_reason = "end_turn") => ({
  stop_reason,
  content: [{ type: "text", text: JSON.stringify(json) }],
})

afterEach(() => setAnthropicClientForTests(null))

describe("generateAssistantReply", () => {
  it("answers from the creator's info with Claude Haiku 5.5", async () => {
    const create = fakeClient(message({ reply: "Costă 250 lei.", needs_human: false }))
    expect(await generateAssistantReply(input)).toEqual({ kind: "answer", reply: "Costă 250 lei." })
    const req = create.mock.calls[0][0]
    expect(req.model).toBe("claude-haiku-5-5")
    expect(req.system).toContain("Preț: 250 lei")
    expect(req.output_config.format.type).toBe("json_schema")
    expect(req.messages.at(-1)).toEqual({ role: "user", content: "Cât costă?" })
  })

  it("hands off when the model says the answer isn't in the info", async () => {
    fakeClient(message({ reply: "Îi transmit Anei.", needs_human: true }))
    expect(await generateAssistantReply(input)).toEqual({ kind: "handoff", reply: "Îi transmit Anei." })
  })

  it("hands off politely on a refusal or an API error", async () => {
    fakeClient(message({ reply: "x", needs_human: false }, "refusal"))
    expect((await generateAssistantReply(input)).kind).toBe("handoff")
    fakeClient(new Error("network down"))
    const r = await generateAssistantReply(input)
    expect(r).toEqual({ kind: "handoff", reply: handoffMessage("ro", "warm", "ana.picteaza") })
  })

  it("strips markdown Instagram can't show", async () => {
    fakeClient(message({ reply: "**Preț:** 250 lei", needs_human: false }))
    expect(await generateAssistantReply(input)).toEqual({ kind: "answer", reply: "Preț: 250 lei" })
  })

  it("always starts the conversation with the person's message", async () => {
    const create = fakeClient(message({ reply: "Da", needs_human: false }))
    await generateAssistantReply({ ...input, history: [{ role: "assistant", text: "Hi" }, { role: "user", text: "Q1" }, { role: "assistant", text: "A1" }] })
    expect(create.mock.calls[0][0].messages[0].role).toBe("user")
  })
})

describe("copy", () => {
  it("detects Romanian and English", () => {
    expect(detectLanguage("Cât costă?")).toBe("ro")
    expect(detectLanguage("unde e atelierul")).toBe("ro")
    expect(detectLanguage("How much is it?")).toBe("en")
  })

  it("says it's an AI assistant, naming the creator", () => {
    expect(disclosureLine("ro", "warm", "ana")).toMatch(/asistentul AI al lui @ana/)
    expect(disclosureLine("en", "professional", "ana")).toMatch(/^Hi! I'm @ana's AI assistant/)
    expect(disclosureLine("en", "warm", "ana").startsWith("🤖")).toBe(true)
  })
})
