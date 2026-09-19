import type { ReviewDraft } from "@/lib/trace-types"

const outcomes = new Set(["met_bar", "did_not_meet_bar", "unclear"])
const criteria = new Set([...outcomes, "not_applicable"])

/**
 * Server-side validation for a review submission.
 *
 * Returns an error message, or null when the draft is acceptable.
 *
 * The rules that matter are the *completion* rules. A draft may be saved in
 * any state — reviewers need to park half-finished work — but a review marked
 * `completed` has to be actionable by someone who was not in the room:
 *
 *   - `did_not_meet_bar` requires a failure span, so the failure is pinned to
 *     a specific step rather than asserted about the run as a whole, plus
 *     either a tag or a written observation saying what went wrong.
 *   - `unclear` requires an uncertainty reason, so "I could not tell" is
 *     distinguishable from "I did not look".
 *
 * This is enforced here rather than only in the UI because the API is the
 * trust boundary: the client can be bypassed, and the completeness guarantee
 * is what downstream evaluator calibration depends on.
 */
export function validateReview(review: ReviewDraft): string | null {
  if (!review || typeof review !== "object") return "Review body is required"
  if (!(review.source === "production" || review.source === "evaluation")) return "Invalid source"
  if (!(review.status === "draft" || review.status === "completed")) return "Invalid review status"
  if (typeof review.traceId !== "string" || typeof review.input !== "string" || typeof review.output !== "string") return "Invalid review payload"
  if (!outcomes.has(review.outcome)) return "Invalid outcome"
  if (![review.decisionQuality, review.executionQuality, review.responseQuality].every((value) => criteria.has(value))) {
    return "Invalid criterion result"
  }
  if (review.traceId.length > 256 || (review.recordId?.length ?? 0) > 256) return "Invalid trace identifier"
  if (review.status === "completed" && review.outcome === "did_not_meet_bar") {
    if (!review.failureSpanId) return "A consequential failure span is required"
    if (!review.tag && !review.observation?.trim()) return "Add a failure tag or open observation"
  }
  if (review.status === "completed" && review.outcome === "unclear" && !review.uncertaintyReason) {
    return "An uncertainty reason is required"
  }
  return null
}
