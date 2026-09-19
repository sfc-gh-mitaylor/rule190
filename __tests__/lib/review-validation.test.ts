import { describe, expect, it } from "vitest"
import { validateReview } from "@/lib/review-validation"
import type { ReviewDraft } from "@/lib/trace-types"

/**
 * The API is the trust boundary: the UI can be bypassed, so the completion
 * rules have to hold here. A "completed" review that nobody can act on is
 * the failure mode these tests prevent — it silently poisons the evaluator
 * calibration the product exists to support.
 */

function draft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    source: "production",
    traceId: "trace-a",
    recordId: null,
    input: "why was my order late?",
    output: "it shipped on the 3rd",
    outcome: "met_bar",
    decisionQuality: "met_bar",
    executionQuality: "met_bar",
    responseQuality: "met_bar",
    failureSpanId: null,
    uncertaintyReason: null,
    tag: null,
    observation: null,
    desiredBehavior: null,
    status: "completed",
    ...overrides,
  }
}

describe("validateReview: accepts well-formed reviews", () => {
  it("accepts a completed pass with no failure detail", () => {
    expect(validateReview(draft())).toBeNull()
  })

  it("accepts a fully specified completed failure", () => {
    expect(validateReview(draft({
      outcome: "did_not_meet_bar",
      failureSpanId: "span-7",
      tag: "wrong_tool",
    }))).toBeNull()
  })
})

describe("validateReview: completion requires a pinned first failure", () => {
  it("rejects a completed failure with no failure span", () => {
    // Without a span the failure is asserted about the whole run, which is
    // not actionable — you cannot fix "it went wrong somewhere".
    expect(validateReview(draft({ outcome: "did_not_meet_bar", tag: "wrong_tool" })))
      .toBe("A consequential failure span is required")
  })

  it("rejects a completed failure with a span but no tag or observation", () => {
    expect(validateReview(draft({ outcome: "did_not_meet_bar", failureSpanId: "span-7" })))
      .toBe("Add a failure tag or open observation")
  })

  it("accepts an observation in place of a tag", () => {
    expect(validateReview(draft({
      outcome: "did_not_meet_bar",
      failureSpanId: "span-7",
      observation: "retrieved the wrong customer record",
    }))).toBeNull()
  })

  it("treats a whitespace-only observation as absent", () => {
    expect(validateReview(draft({
      outcome: "did_not_meet_bar",
      failureSpanId: "span-7",
      observation: "   ",
    }))).toBe("Add a failure tag or open observation")
  })
})

describe("validateReview: completion requires a reason for uncertainty", () => {
  it("rejects a completed unclear review with no uncertainty reason", () => {
    // This is what separates "I could not tell" from "I did not look".
    expect(validateReview(draft({ outcome: "unclear" })))
      .toBe("An uncertainty reason is required")
  })

  it("accepts a completed unclear review with a reason", () => {
    expect(validateReview(draft({ outcome: "unclear", uncertaintyReason: "missing_ground_truth" })))
      .toBeNull()
  })
})

describe("validateReview: drafts are exempt from completion rules", () => {
  it("accepts an incomplete failure saved as a draft", () => {
    // Reviewers must be able to park half-finished work; the rules bind on
    // completion, not on saving.
    expect(validateReview(draft({ outcome: "did_not_meet_bar", status: "draft" }))).toBeNull()
  })

  it("accepts an unclear review with no reason saved as a draft", () => {
    expect(validateReview(draft({ outcome: "unclear", status: "draft" }))).toBeNull()
  })
})

describe("validateReview: rejects malformed payloads", () => {
  it("rejects an unknown outcome", () => {
    expect(validateReview(draft({ outcome: "looks_fine" as ReviewDraft["outcome"] })))
      .toBe("Invalid outcome")
  })

  it("rejects an unknown criterion result", () => {
    expect(validateReview(draft({ decisionQuality: "great" as ReviewDraft["decisionQuality"] })))
      .toBe("Invalid criterion result")
  })

  it("rejects an unknown source", () => {
    expect(validateReview(draft({ source: "staging" as ReviewDraft["source"] })))
      .toBe("Invalid source")
  })

  it("rejects an over-long trace id", () => {
    expect(validateReview(draft({ traceId: "x".repeat(257) })))
      .toBe("Invalid trace identifier")
  })
})
