import { asObject, pickText, toIso } from "@/lib/trace-adapter"
import type { TraceSummary } from "@/lib/trace-types"

/**
 * Collapse raw AI-observability event rows into one summary per trace.
 *
 * GET_AI_OBSERVABILITY_EVENTS returns one row per *span event*, not per
 * conversation: in the Eudemo account 938 rows represent 93 traces. Grouping
 * is therefore not cosmetic — without it the reviewer is shown a flat list of
 * span fragments instead of a list of agent runs to review.
 *
 * The trace id is read from TRACE:trace_id and falls back to
 * RECORD_ATTRIBUTES["snow.trace_id"], because the two shapes appear in the
 * same result set depending on how the event was emitted. Rows with neither
 * are dropped rather than grouped under the empty string, which would merge
 * unrelated events into one bogus trace.
 */
export function normalizeProduction(rows: Record<string, any>[]): TraceSummary[] {
  const groups = new Map<string, Record<string, any>[]>()
  for (const row of rows) {
    const trace = asObject(row.TRACE)
    const attributes = asObject(row.RECORD_ATTRIBUTES)
    const id = String(trace.trace_id ?? attributes["snow.trace_id"] ?? "")
    if (!id) continue
    groups.set(id, [...(groups.get(id) ?? []), row])
  }

  return [...groups.entries()].map(([id, events]) => {
    const combined = events.map((event) => ({
      record: asObject(event.RECORD),
      attributes: asObject(event.RECORD_ATTRIBUTES),
      value: asObject(event.VALUE),
      resource: asObject(event.RESOURCE_ATTRIBUTES),
    }))
    const serialized = combined
    const input = pickText(serialized, ["input", "input_query", "query", "question", "prompt"])
    const output = pickText([...serialized].reverse(), ["output", "response", "answer", "content"])
    const hasError = events.some((event) => {
      const record = asObject(event.RECORD)
      return String(record.severity_text ?? "").toUpperCase() === "ERROR"
    })
    const feedbackName = events.find((event) => asObject(event.RECORD).name === "CORTEX_AGENT_FEEDBACK")
    const feedbackText = JSON.stringify(feedbackName?.VALUE ?? "").toLowerCase()
    return {
      id,
      recordId: pickText(serialized, ["record_id"]) || null,
      requestId: pickText(serialized, ["request_id"]) || null,
      source: "production" as const,
      input: input || "Input unavailable or redacted",
      output: output || "Output unavailable or redacted",
      timestamp: toIso(events[events.length - 1]?.TIMESTAMP),
      durationMs: null,
      status: hasError ? "error" : "complete",
      agentVersion: pickText(serialized, ["agent_version", "version_name"]) || null,
      runName: null,
      toolCount: events.filter((event) => JSON.stringify(event).toLowerCase().includes("tool")).length,
      errorCount: hasError ? 1 : 0,
      feedback: feedbackName ? (feedbackText.includes("negative") ? "negative" as const : "positive" as const) : null,
    }
  })
}
