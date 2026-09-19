export type TraceSource = "production" | "evaluation"
export type ReviewOutcome = "met_bar" | "did_not_meet_bar" | "unclear"
export type CriterionResult = ReviewOutcome | "not_applicable"

export interface TraceSummary {
  id: string
  recordId: string | null
  requestId: string | null
  source: TraceSource
  input: string
  output: string
  timestamp: string | null
  durationMs: number | null
  status: string
  agentVersion: string | null
  runName: string | null
  toolCount: number
  errorCount: number
  feedback: "positive" | "negative" | null
}

export interface TraceSpan {
  id: string
  parentId: string | null
  name: string
  type: string
  status: string
  timestamp: string | null
  durationMs: number | null
  input: string | null
  output: string | null
  error: string | null
  raw: unknown
}

export interface TraceDetail extends TraceSummary {
  spans: TraceSpan[]
  groundTruth: string | null
  metrics: Array<{ name: string; score: number | null; explanation: string | null }>
}

export interface ReviewDraft {
  source: TraceSource
  traceId: string
  recordId: string | null
  input: string
  output: string
  outcome: ReviewOutcome
  decisionQuality: CriterionResult
  executionQuality: CriterionResult
  responseQuality: CriterionResult
  failureSpanId: string | null
  uncertaintyReason: string | null
  tag: string | null
  observation: string | null
  desiredBehavior: string | null
  status: "draft" | "completed"
}