import { describe, expect, it } from "vitest"
import { normalizeProduction } from "@/lib/trace-normalize"

/**
 * GET_AI_OBSERVABILITY_EVENTS returns one row per span event, not one per
 * agent run. In the Eudemo account 938 rows collapse to 93 traces. If that
 * grouping regresses the reviewer is shown span fragments instead of runs,
 * and the app silently becomes useless while every request still returns 200.
 * These tests exist to make that failure loud.
 */

/** Minimal event row in the shape the Snowflake driver returns. */
function event(traceId: string | null, overrides: Record<string, any> = {}) {
  return {
    TRACE: traceId === null ? null : { trace_id: traceId },
    RECORD: { name: "span", severity_text: "INFO" },
    RECORD_ATTRIBUTES: {},
    VALUE: {},
    RESOURCE_ATTRIBUTES: {},
    TIMESTAMP: "2026-03-27T10:00:00.000Z",
    ...overrides,
  }
}

describe("normalizeProduction trace grouping", () => {
  it("collapses many events sharing a trace_id into one summary per trace", () => {
    const rows = [
      event("trace-a"),
      event("trace-a"),
      event("trace-a"),
      event("trace-b"),
      event("trace-b"),
    ]

    const traces = normalizeProduction(rows)

    expect(traces).toHaveLength(2)
    expect(traces.map((trace) => trace.id).sort()).toEqual(["trace-a", "trace-b"])
  })

  it("falls back to RECORD_ATTRIBUTES snow.trace_id when TRACE has no trace_id", () => {
    // Both shapes appear in the same result set depending on how the event
    // was emitted, so the fallback is load-bearing rather than defensive.
    const rows = [
      event(null, { RECORD_ATTRIBUTES: { "snow.trace_id": "trace-c" } }),
      event("trace-c"),
    ]

    const traces = normalizeProduction(rows)

    expect(traces).toHaveLength(1)
    expect(traces[0].id).toBe("trace-c")
  })

  it("drops events with no usable trace id instead of grouping them together", () => {
    // Grouping these under "" would merge unrelated runs into one bogus
    // trace, which is worse than losing them: it invents a review subject.
    const rows = [event(null), event(null, { TRACE: {} }), event("trace-d")]

    const traces = normalizeProduction(rows)

    expect(traces).toHaveLength(1)
    expect(traces[0].id).toBe("trace-d")
  })

  it("marks a trace as errored when any one of its events is an ERROR", () => {
    const rows = [
      event("trace-e"),
      event("trace-e", { RECORD: { name: "span", severity_text: "ERROR" } }),
    ]

    const [trace] = normalizeProduction(rows)

    expect(trace.status).toBe("error")
    expect(trace.errorCount).toBe(1)
  })

  it("reports a clean trace as complete with no error count", () => {
    const [trace] = normalizeProduction([event("trace-f"), event("trace-f")])

    expect(trace.status).toBe("complete")
    expect(trace.errorCount).toBe(0)
  })

  it("returns an empty list for no rows rather than throwing", () => {
    // The app must render an honest empty state, not a 500, when an agent
    // has no traces yet.
    expect(normalizeProduction([])).toEqual([])
  })
})
