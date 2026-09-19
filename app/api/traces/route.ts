import { querySnowflake } from "@/lib/snowflake"
import {
  asObject,
  compactText,
  evaluationTraceSql,
  pickText,
  productionTraceSql,
  toIso,
} from "@/lib/trace-adapter"
import type { TraceSource, TraceSummary } from "@/lib/trace-types"

export const dynamic = "force-dynamic"

function normalizeEvaluation(rows: Record<string, any>[]): TraceSummary[] {
  const traces = new Map<string, TraceSummary>()
  for (const row of rows) {
    const id = String(row.RECORD_ID ?? row.REQUEST_ID ?? row.INPUT_ID ?? "")
    if (!id || traces.has(id)) continue
    traces.set(id, {
      id,
      recordId: row.RECORD_ID ? String(row.RECORD_ID) : null,
      requestId: row.REQUEST_ID ? String(row.REQUEST_ID) : null,
      source: "evaluation",
      input: compactText(row.INPUT, 1200) ?? "Input unavailable",
      output: compactText(row.OUTPUT, 1600) ?? "Output unavailable",
      timestamp: toIso(row.TIMESTAMP),
      durationMs: row.DURATION_MS === null ? null : Number(row.DURATION_MS),
      status: row.ERROR ? "error" : "complete",
      agentVersion: compactText(row.AGENT_VERSION, 100),
      runName: compactText(row.RUN_NAME, 200),
      toolCount: Number(row.TOOL_CALL_COUNT ?? 0),
      errorCount: row.ERROR ? 1 : 0,
      feedback: null,
    })
  }
  return [...traces.values()]
}

function normalizeProduction(rows: Record<string, any>[]): TraceSummary[] {
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

export async function GET(request: Request) {
  const url = new URL(request.url)
  const source = (url.searchParams.get("source") ?? "production") as TraceSource
  const runName = url.searchParams.get("run")
  if (!(["production", "evaluation"] as string[]).includes(source)) {
    return Response.json({ error: "Invalid trace source" }, { status: 400 })
  }
  if (source === "evaluation" && !runName) {
    return Response.json({ traces: [], source, needsRunName: true })
  }

  try {
    const rows = source === "production"
      ? await querySnowflake(productionTraceSql(), { callersRights: true, timeoutMs: 30_000 })
      : await querySnowflake(evaluationTraceSql(), { callersRights: true, binds: [runName!], timeoutMs: 30_000 })
    const traces = source === "production" ? normalizeProduction(rows) : normalizeEvaluation(rows)
    return Response.json({ traces, source, runName, fetchedAt: new Date().toISOString() })
  } catch (error) {
    console.error(new Date().toISOString(), "Trace list query failed", error)
    return Response.json({ error: error instanceof Error ? error.message : "Trace query failed" }, { status: 500 })
  }
}