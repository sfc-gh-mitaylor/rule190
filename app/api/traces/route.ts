import { querySnowflake } from "@/lib/snowflake"
import {
  compactText,
  evaluationTraceSql,
  productionTraceSql,
  toIso,
} from "@/lib/trace-adapter"
import { normalizeProduction } from "@/lib/trace-normalize"
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