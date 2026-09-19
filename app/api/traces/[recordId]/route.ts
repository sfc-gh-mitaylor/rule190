import { querySnowflake } from "@/lib/snowflake"
import { asObject, compactText, pickText, productionRecordTraceSql, recordTraceSql, toIso } from "@/lib/trace-adapter"
import type { TraceDetail, TraceSpan } from "@/lib/trace-types"

export const dynamic = "force-dynamic"

export async function GET(request: Request, context: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await context.params
  if (!recordId || recordId.length > 256) return Response.json({ error: "Invalid record ID" }, { status: 400 })
  try {
    const source = new URL(request.url).searchParams.get("source") === "production" ? "production" : "evaluation"
    const rows = await querySnowflake(source === "production" ? productionRecordTraceSql() : recordTraceSql(), {
      callersRights: true,
      binds: [recordId],
    })
    const first = rows[0] ?? {}
    const spans: TraceSpan[] = rows.map((row, index) => {
      const record = asObject(row.RECORD)
      const attributes = asObject(row.RECORD_ATTRIBUTES)
      const value = asObject(row.VALUE)
      const raw = source === "production" ? { record, attributes, value } : row
      return {
        id: String(row.SPAN_ID ?? asObject(row.TRACE).span_id ?? attributes["span_id"] ?? `${recordId}-${index}`),
        parentId: row.PARENT_SPAN_ID ? String(row.PARENT_SPAN_ID) : null,
        name: String(row.SPAN_NAME ?? record.name ?? attributes["span.name"] ?? `Step ${index + 1}`),
        type: String(row.SPAN_TYPE ?? record.type ?? "step"),
        status: String(row.STATUS ?? record.severity_text ?? (row.ERROR ? "error" : "complete")),
        timestamp: toIso(row.START_TIMESTAMP ?? row.TIMESTAMP),
        durationMs: row.DURATION_MS === null || row.DURATION_MS === undefined ? null : Number(row.DURATION_MS),
        input: compactText(row.INPUT ?? row.TOOL_INPUT ?? pickText(raw, ["input", "query", "prompt"])),
        output: compactText(row.OUTPUT ?? row.TOOL_OUTPUT ?? pickText(raw, ["output", "response", "answer"])),
        error: compactText(row.ERROR ?? pickText(raw, ["error", "error_message"])),
        raw,
      }
    })
    const metrics = rows.filter((row) => row.METRIC_NAME).map((row) => ({
      name: String(row.METRIC_NAME),
      score: row.EVAL_AGG_SCORE === null ? null : Number(row.EVAL_AGG_SCORE),
      explanation: compactText(row.METRIC_CALLS),
    }))
    const rawSpans = spans.map((span) => span.raw)
    const detail: TraceDetail = {
      id: recordId,
      recordId: source === "evaluation" ? recordId : pickText(rawSpans, ["record_id"]) || null,
      requestId: first.REQUEST_ID ? String(first.REQUEST_ID) : pickText(rawSpans, ["request_id"]) || null,
      source,
      input: compactText(first.INPUT ?? pickText(rawSpans, ["input", "input_query", "query", "question"]), 12000) ?? "Input unavailable",
      output: compactText(first.OUTPUT ?? pickText([...rawSpans].reverse(), ["output", "response", "answer"]), 16000) ?? "Output unavailable",
      timestamp: toIso(first.TIMESTAMP ?? first.START_TIMESTAMP),
      durationMs: first.DURATION_MS === null || first.DURATION_MS === undefined ? null : Number(first.DURATION_MS),
      status: first.ERROR ? "error" : "complete",
      agentVersion: compactText(first.AGENT_VERSION ?? pickText(rawSpans, ["agent_version", "version_name"]), 100),
      runName: compactText(first.RUN_NAME, 200),
      toolCount: spans.filter((span) => span.type.toLowerCase().includes("tool") || span.name.toLowerCase().includes("tool")).length,
      errorCount: spans.filter((span) => span.error || span.status.toLowerCase().includes("error")).length,
      feedback: null,
      spans,
      groundTruth: compactText(first.GROUND_TRUTH),
      metrics,
    }
    return Response.json(detail)
  } catch (error) {
    console.error(new Date().toISOString(), "Trace detail query failed", error)
    return Response.json({ error: error instanceof Error ? error.message : "Trace detail failed" }, { status: 500 })
  }
}