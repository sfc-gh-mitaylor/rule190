import { querySnowflake } from "@/lib/snowflake"
import { agentFqn, reviewTable } from "@/lib/trace-adapter"
import type { ReviewDraft } from "@/lib/trace-types"

export const dynamic = "force-dynamic"

const outcomes = new Set(["met_bar", "did_not_meet_bar", "unclear"])
const criteria = new Set([...outcomes, "not_applicable"])

function validate(review: ReviewDraft): string | null {
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

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const traceId = params.get("traceId")
  const source = params.get("source")
  if (!traceId) return Response.json({ error: "traceId is required" }, { status: 400 })
  if (!(source === "production" || source === "evaluation")) return Response.json({ error: "source is required" }, { status: 400 })
  try {
    const rows = await querySnowflake(
      `SELECT * FROM ${reviewTable()} WHERE REVIEWER = CURRENT_USER() AND SOURCE = ? AND AGENT_FQN = ? AND TRACE_ID = ? ORDER BY UPDATED_AT DESC LIMIT 1`,
      { binds: [source, agentFqn, traceId] },
    )
    return Response.json({ review: rows[0] ?? null })
  } catch (error) {
    console.error(new Date().toISOString(), "Review read failed", error)
    return Response.json({ error: error instanceof Error ? error.message : "Review read failed" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  let review: ReviewDraft
  try {
    review = await request.json() as ReviewDraft
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const validationError = validate(review)
  if (validationError) return Response.json({ error: validationError }, { status: 400 })

  try {
    const sql = `
      MERGE INTO ${reviewTable()} target
      USING (
        SELECT CURRENT_USER() REVIEWER, ? SOURCE, ? AGENT_FQN, ? TRACE_ID, ? RECORD_ID,
          ? INPUT_SNAPSHOT, ? OUTPUT_SNAPSHOT, ? OUTCOME, ? DECISION_QUALITY,
          ? EXECUTION_QUALITY, ? RESPONSE_QUALITY, ? FAILURE_SPAN_ID,
          ? UNCERTAINTY_REASON, ? FAILURE_TAG, ? OBSERVATION, ? DESIRED_BEHAVIOR,
          ? REVIEW_STATUS
      ) source
      ON target.REVIEWER = source.REVIEWER
        AND target.SOURCE = source.SOURCE
        AND target.AGENT_FQN = source.AGENT_FQN
        AND target.TRACE_ID = source.TRACE_ID
      WHEN MATCHED THEN UPDATE SET
        RECORD_ID = source.RECORD_ID, INPUT_SNAPSHOT = source.INPUT_SNAPSHOT,
        OUTPUT_SNAPSHOT = source.OUTPUT_SNAPSHOT, OUTCOME = source.OUTCOME,
        DECISION_QUALITY = source.DECISION_QUALITY, EXECUTION_QUALITY = source.EXECUTION_QUALITY,
        RESPONSE_QUALITY = source.RESPONSE_QUALITY, FAILURE_SPAN_ID = source.FAILURE_SPAN_ID,
        UNCERTAINTY_REASON = source.UNCERTAINTY_REASON, FAILURE_TAG = source.FAILURE_TAG,
        OBSERVATION = source.OBSERVATION, DESIRED_BEHAVIOR = source.DESIRED_BEHAVIOR,
        REVIEW_STATUS = source.REVIEW_STATUS, UPDATED_AT = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
        REVIEWER, SOURCE, AGENT_FQN, TRACE_ID, RECORD_ID, INPUT_SNAPSHOT, OUTPUT_SNAPSHOT,
        OUTCOME, DECISION_QUALITY, EXECUTION_QUALITY, RESPONSE_QUALITY, FAILURE_SPAN_ID,
        UNCERTAINTY_REASON, FAILURE_TAG, OBSERVATION, DESIRED_BEHAVIOR, REVIEW_STATUS
      ) VALUES (
        source.REVIEWER, source.SOURCE, source.AGENT_FQN, source.TRACE_ID, source.RECORD_ID,
        source.INPUT_SNAPSHOT, source.OUTPUT_SNAPSHOT, source.OUTCOME, source.DECISION_QUALITY,
        source.EXECUTION_QUALITY, source.RESPONSE_QUALITY, source.FAILURE_SPAN_ID,
        source.UNCERTAINTY_REASON, source.FAILURE_TAG, source.OBSERVATION,
        source.DESIRED_BEHAVIOR, source.REVIEW_STATUS
      )
    `
    await querySnowflake(sql, {
      binds: [
        review.source, agentFqn, review.traceId, review.recordId, review.input.slice(0, 16000),
        review.output.slice(0, 24000), review.outcome, review.decisionQuality,
        review.executionQuality, review.responseQuality, review.failureSpanId,
        review.uncertaintyReason, review.tag, review.observation?.slice(0, 12000) ?? null,
        review.desiredBehavior?.slice(0, 12000) ?? null, review.status,
      ],
    })
    return Response.json({ saved: true, status: review.status, savedAt: new Date().toISOString() })
  } catch (error) {
    console.error(new Date().toISOString(), "Review save failed", error)
    return Response.json({ error: error instanceof Error ? error.message : "Review save failed" }, { status: 500 })
  }
}