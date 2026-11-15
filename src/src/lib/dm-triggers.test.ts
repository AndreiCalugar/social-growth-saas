import { describe, expect, it } from "vitest"
import { automationTriggers, messageTrigger, needsKeywords, normalizeTriggers, primaryTrigger } from "./dm-triggers"

describe("normalizeTriggers", () => {
  it("keeps valid triggers in a fixed order without duplicates", () => {
    expect(normalizeTriggers(["dm", "comment", "dm"])).toEqual(["comment", "dm"])
    expect(normalizeTriggers(["story_reply", "comment"])).toEqual(["comment", "story_reply"])
  })

  it("drops story_reply next to dm, which already covers story replies", () => {
    expect(normalizeTriggers(["dm", "story_reply"])).toEqual(["dm"])
    expect(normalizeTriggers(["comment", "dm", "story_reply"])).toEqual(["comment", "dm"])
  })

  it("rejects empty, unknown or non-array input", () => {
    expect(normalizeTriggers([])).toBeNull()
    expect(normalizeTriggers(["comment", "email"])).toBeNull()
    expect(normalizeTriggers("comment")).toBeNull()
    expect(normalizeTriggers(undefined)).toBeNull()
  })
})

describe("automationTriggers", () => {
  it("reads the triggers list, then the old single trigger_type, then defaults to comment", () => {
    expect(automationTriggers({ triggers: ["comment", "dm"], trigger_type: "comment" })).toEqual(["comment", "dm"])
    expect(automationTriggers({ trigger_type: "story_reply" })).toEqual(["story_reply"])
    expect(automationTriggers({ triggers: null, trigger_type: null })).toEqual(["comment"])
    expect(automationTriggers({})).toEqual(["comment"])
  })
})

describe("primaryTrigger", () => {
  it("prefers comment, so pre-027 code keeps finding the post", () => {
    expect(primaryTrigger(["comment", "dm"])).toBe("comment")
    expect(primaryTrigger(["dm"])).toBe("dm")
  })
})

describe("messageTrigger", () => {
  it("routes story replies to story_reply first, then dm", () => {
    expect(messageTrigger(["story_reply"], true)).toBe("story_reply")
    expect(messageTrigger(["dm"], true)).toBe("dm")
    expect(messageTrigger(["comment", "story_reply"], true)).toBe("story_reply")
  })

  it("only dm automations answer plain messages", () => {
    expect(messageTrigger(["dm"], false)).toBe("dm")
    expect(messageTrigger(["story_reply"], false)).toBeNull()
    expect(messageTrigger(["comment"], false)).toBeNull()
    expect(messageTrigger(["comment"], true)).toBeNull()
  })
})

describe("new_conversation", () => {
  it("is a valid trigger, alone or with others", () => {
    expect(normalizeTriggers(["new_conversation"])).toEqual(["new_conversation"])
    expect(normalizeTriggers(["new_conversation", "comment"])).toEqual(["comment", "new_conversation"])
  })

  it("never answers a keyword message by itself", () => {
    expect(messageTrigger(["new_conversation"], false)).toBeNull()
    expect(messageTrigger(["new_conversation"], true)).toBeNull()
  })

  it("is the only trigger that works without keywords", () => {
    expect(needsKeywords(["new_conversation"])).toBe(false)
    expect(needsKeywords(["new_conversation", "dm"])).toBe(true)
    expect(needsKeywords(["comment"])).toBe(true)
  })
})
