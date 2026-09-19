"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import type { CriterionResult, ReviewDraft, ReviewOutcome, TraceDetail, TraceSource, TraceSummary } from "@/lib/trace-types"

const criteria: Array<{ key: "decisionQuality" | "executionQuality" | "responseQuality"; label: string }> = [
  { key: "decisionQuality", label: "Decision" },
  { key: "executionQuality", label: "Execution" },
  { key: "responseQuality", label: "Response" },
]

const tags = [
  "wrong_tool_selection",
  "tool_input_failure",
  "unsupported_interpretation",
  "semantic_view_resolution_failure",
  "incomplete_answer",
  "missing_evidence",
  "unsafe_or_unapproved_action",
]

const blankReview = (trace: TraceSummary): ReviewDraft => ({
  source: trace.source,
  traceId: trace.id,
  recordId: trace.recordId,
  input: trace.input,
  output: trace.output,
  outcome: "unclear",
  decisionQuality: "unclear",
  executionQuality: "unclear",
  responseQuality: "unclear",
  failureSpanId: null,
  uncertaintyReason: "missing_evidence",
  tag: null,
  observation: null,
  desiredBehavior: null,
  status: "draft",
})

function label(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase())
}

function elapsed(duration: number | null) {
  if (duration === null) return "--"
  return duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`
}

export function ReviewWorkbench() {
  const [source, setSource] = useState<TraceSource>("production")
  const [mode, setMode] = useState<"discovery" | "deep_dive">("discovery")
  const [runName, setRunName] = useState("")
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TraceDetail | null>(null)
  const [review, setReview] = useState<ReviewDraft | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [openSpans, setOpenSpans] = useState<Set<string>>(new Set())
  const [activeView, setActiveView] = useState<"review" | "synthesis" | "calibration">("review")

  const loadTraces = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ source })
    if (source === "evaluation" && runName.trim()) params.set("run", runName.trim())
    try {
      const response = await fetch(`/api/traces?${params}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not load traces")
      setTraces(body.traces ?? [])
      setSelectedId((current) => current && body.traces.some((trace: TraceSummary) => trace.id === current) ? current : body.traces[0]?.id ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load traces")
      setTraces([])
      setSelectedId(null)
    } finally {
      setLoading(false)
    }
  }, [runName, source])

  useEffect(() => { void loadTraces() }, [loadTraces])

  const selected = traces.find((trace) => trace.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) {
      setDetail(null)
      setReview(null)
      return
    }
    setReview(blankReview(selected))
    setDetail({ ...selected, spans: [], groundTruth: null, metrics: [] })
    setOpenSpans(new Set())
    const detailId = selected.source === "evaluation" ? selected.recordId : selected.id
    if (detailId) {
      fetch(`/api/traces/${encodeURIComponent(detailId)}?source=${selected.source}`)
        .then(async (response) => {
          const body = await response.json()
          if (!response.ok) throw new Error(body.error ?? "Trace detail failed")
          setDetail(body)
          setOpenSpans(new Set(body.spans.filter((span: { status: string; error: string | null }) => span.error || span.status === "error").map((span: { id: string }) => span.id)))
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Trace detail failed"))
    }
  }, [selectedId])

  useEffect(() => {
    if (!review || saveState === "saved") return
    const timer = window.setTimeout(async () => {
      setSaveState("saving")
      const response = await fetch("/api/reviews", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...review, status: "draft" }) })
      setSaveState(response.ok ? "saved" : "error")
    }, 900)
    return () => window.clearTimeout(timer)
  }, [review])

  const mutateReview = (patch: Partial<ReviewDraft>) => {
    setSaveState("idle")
    setReview((current) => current ? { ...current, ...patch } : current)
  }

  const filtered = useMemo(() => traces.filter((trace) => `${trace.input} ${trace.output}`.toLowerCase().includes(query.toLowerCase())), [query, traces])
  const index = selected ? traces.findIndex((trace) => trace.id === selected.id) : -1

  const move = (offset: number) => {
    if (!traces.length) return
    const target = Math.min(traces.length - 1, Math.max(0, index + offset))
    setSelectedId(traces[target].id)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return
      if (event.key === "j") move(1)
      if (event.key === "k") move(-1)
      if (event.key === "1") mutateReview({ outcome: "met_bar", uncertaintyReason: null })
      if (event.key === "2") mutateReview({ outcome: "did_not_meet_bar", uncertaintyReason: null })
      if (event.key === "3") mutateReview({ outcome: "unclear", uncertaintyReason: "missing_evidence" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, traces, review])

  const complete = async () => {
    if (!review) return
    setSaveState("saving")
    const response = await fetch("/api/reviews", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...review, status: "completed" }) })
    if (response.ok) {
      setSaveState("saved")
      move(1)
    } else {
      const body = await response.json()
      setError(body.error ?? "Review could not be completed")
      setSaveState("error")
    }
  }

  return (
    <main className="workbench-shell">
      <nav className="view-tabs" aria-label="Workbench section">
        {(["review", "synthesis", "calibration"] as const).map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => setActiveView(view)}>{label(view)}</button>)}
        <div className="mode-switch"><span>Review mode</span><button className={mode === "discovery" ? "active" : ""} onClick={() => setMode("discovery")}>Discovery</button><button className={mode === "deep_dive" ? "active" : ""} onClick={() => setMode("deep_dive")}>Deep dive</button></div>
      </nav>
      {activeView !== "review" ? <section className="incubation-view"><div className="river-mark"/><div className="eyebrow">{label(activeView)}</div><h1>{activeView === "synthesis" ? "Turn observations into a stable taxonomy" : "Calibrate judges against held-out human labels"}</h1><p>{activeView === "synthesis" ? "Completed open observations will be grouped here without rewriting the reviewer’s original evidence." : "Only resolved human labels belong in calibration sets. Unclear cases stay in the resolution queue."}</p><div className="stage-line"><span className="done">Human evidence</span><span>Candidate</span><span>Validate</span><span>Approve</span></div></section> : <div className="workbench">
      <aside className="queue-pane">
        <div className="queue-header">
          <div className="eyebrow">Review queue</div>
          <div className="source-switch" role="group" aria-label="Trace source">
            {(["production", "evaluation"] as TraceSource[]).map((item) => (
              <button key={item} className={source === item ? "active" : ""} onClick={() => setSource(item)}>{label(item)}</button>
            ))}
          </div>
          {source === "evaluation" && <div className="run-input"><input aria-label="Evaluation run name" value={runName} onChange={(event) => setRunName(event.target.value)} placeholder="Evaluation run name" /><button aria-label="Load run" onClick={loadTraces}><RefreshCw size={15}/></button></div>}
          <label className="search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" /></label>
          <div className="queue-meta"><span>{filtered.length} traces</span><button className="icon-button" aria-label="Refresh traces" onClick={loadTraces}><RefreshCw size={15}/></button></div>
        </div>
        <div className="trace-list">
          {loading && <div className="empty-state">Loading authorized traces...</div>}
          {!loading && !filtered.length && <div className="empty-state"><CircleHelp size={20}/><strong>No traces in this queue</strong><span>{source === "production" ? "No production events are currently visible for this agent and role." : "Enter an existing evaluation run name."}</span></div>}
          {filtered.map((trace) => (
            <button key={trace.id} onClick={() => setSelectedId(trace.id)} className={`trace-row ${selectedId === trace.id ? "selected" : ""}`}>
              <span className={`status-dot ${trace.status}`} />
              <span className="trace-copy"><strong>{trace.input}</strong><small>{trace.agentVersion ?? "Version unknown"} · {elapsed(trace.durationMs)}</small></span>
              {trace.errorCount > 0 && <AlertTriangle size={14}/>} 
            </button>
          ))}
        </div>
        <div className="queue-footer"><span>{index >= 0 ? `${index + 1} of ${traces.length}` : "0 of 0"}</span><span><kbd>K</kbd> prev <kbd>J</kbd> next</span></div>
      </aside>

      <section className="trajectory-pane">
        {error && <div className="error-banner"><AlertTriangle size={16}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError(null)}><X size={15}/></button></div>}
        {!selected || !detail ? <div className="canvas-empty"><div className="river-mark"/><h1>Select a trace to begin</h1><p>Task context and trajectory evidence remain central while you review.</p></div> : <>
          <header className="task-header">
            <div><div className="eyebrow">User goal</div><h1>{detail.input}</h1></div>
            <div className="task-actions"><button className="icon-button" disabled={index <= 0} onClick={() => move(-1)}><ArrowLeft size={17}/></button><button className="icon-button" disabled={index >= traces.length - 1} onClick={() => move(1)}><ArrowRight size={17}/></button></div>
          </header>
          <div className="trace-meta"><span>{detail.source}</span><span>{detail.agentVersion ?? "version unknown"}</span><span>{elapsed(detail.durationMs)}</span><span>{detail.toolCount} tools</span>{detail.errorCount > 0 && <span className="danger">{detail.errorCount} errors</span>}</div>
          <article className="answer-block"><div className="eyebrow">Agent response</div><p>{detail.output}</p></article>
          {detail.metrics.length > 0 && <div className="metric-strip">{detail.metrics.map((metric) => <div key={metric.name}><span>{label(metric.name)}</span><strong>{metric.score?.toFixed(2) ?? "--"}</strong></div>)}</div>}
          <div className="trajectory-title"><div><div className="eyebrow">Trajectory</div><h2>{detail.spans.length ? `${detail.spans.length} execution steps` : "Trace detail"}</h2></div><span>Select the first consequential failure</span></div>
          {!detail.spans.length && <div className="empty-trajectory">Production span detail is loaded only when native event rows are available. The task and response remain reviewable.</div>}
          <div className="span-list">{detail.spans.map((span, spanIndex) => {
            const open = openSpans.has(span.id)
            const selectedFailure = review?.failureSpanId === span.id
            return <div className={`span ${selectedFailure ? "failure" : ""}`} key={span.id}>
              <button className="span-summary" onClick={() => setOpenSpans((current) => { const next = new Set(current); open ? next.delete(span.id) : next.add(span.id); return next })}>
                {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<span className="step-number">{spanIndex + 1}</span><span className="span-copy"><strong>{span.name}</strong><small>{span.type} · {elapsed(span.durationMs)}</small></span><span className={`span-status ${span.error ? "error" : ""}`}>{span.error ? "Error" : span.status}</span>
              </button>
              {open && <div className="span-detail">{span.input && <div><label>Input</label><pre>{span.input}</pre></div>}{span.output && <div><label>Output</label><pre>{span.output}</pre></div>}{span.error && <div><label>Error</label><pre className="error-text">{span.error}</pre></div>}<button className="failure-button" onClick={() => mutateReview({ failureSpanId: span.id })}>{selectedFailure ? <Check size={15}/> : null}{selectedFailure ? "Marked as first failure" : "Mark first consequential failure"}</button></div>}
            </div>
          })}</div>
        </>}
      </section>

      <aside className="judgment-pane">
        <div className="judgment-scroll">
          <div className="eyebrow">Human judgment</div><h2>Did this meet the bar?</h2>
          <div className="outcome-grid">{([
            ["met_bar", "Met bar", Check], ["did_not_meet_bar", "Did not meet", X], ["unclear", "Unclear", CircleHelp],
          ] as Array<[ReviewOutcome, string, typeof Check]>).map(([value, text, Icon]) => <button key={value} disabled={!review} className={review?.outcome === value ? `selected ${value}` : ""} onClick={() => mutateReview({ outcome: value, uncertaintyReason: value === "unclear" ? "missing_evidence" : null })}><Icon size={17}/><span>{text}</span></button>)}</div>
          <div className="shortcut-hint"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></div>
          <div className="form-section"><h3>Quality dimensions</h3>{criteria.map(({ key, label: criterionLabel }) => <div className="criterion" key={key}><label>{criterionLabel}</label><select disabled={!review} value={review?.[key] ?? "unclear"} onChange={(event) => mutateReview({ [key]: event.target.value as CriterionResult })}><option value="met_bar">Met bar</option><option value="did_not_meet_bar">Did not meet</option><option value="unclear">Unclear</option><option value="not_applicable">Not applicable</option></select></div>)}</div>
          {review?.outcome === "unclear" && <div className="form-section"><label htmlFor="uncertainty">Why is it unclear?</label><select id="uncertainty" value={review.uncertaintyReason ?? "missing_evidence"} onChange={(event) => mutateReview({ uncertaintyReason: event.target.value })}><option value="missing_evidence">Missing evidence</option><option value="ambiguous_quality_bar">Ambiguous quality bar</option><option value="insufficient_domain_expertise">Insufficient expertise</option><option value="other">Other</option></select></div>}
          {review?.outcome === "did_not_meet_bar" && <><div className="form-section"><label htmlFor="failure-tag">Known failure</label><select id="failure-tag" value={review.tag ?? ""} onChange={(event) => mutateReview({ tag: event.target.value || null })}><option value="">Open observation</option>{tags.map((tag) => <option key={tag} value={tag}>{label(tag)}</option>)}</select>{review.failureSpanId ? <div className="evidence-selected"><Check size={14}/> Failure evidence anchored</div> : <div className="evidence-missing"><AlertTriangle size={14}/> Select the first failure in the trajectory</div>}</div></>}
          <div className="form-section"><label htmlFor="observation">Review note</label><textarea id="observation" disabled={!review} value={review?.observation ?? ""} onChange={(event) => mutateReview({ observation: event.target.value })} placeholder="What did you observe? Use your own language." /></div>
          <div className="form-section"><label htmlFor="desired">Desired behavior</label><textarea id="desired" disabled={!review} value={review?.desiredBehavior ?? ""} onChange={(event) => mutateReview({ desiredBehavior: event.target.value })} placeholder="What should the agent have done instead?" /></div>
        </div>
        <div className="judgment-footer"><span className={`save-state ${saveState}`}>{saveState === "saving" ? "Saving..." : saveState === "error" ? "Save failed" : saveState === "saved" ? "Saved" : "Draft"}</span><button className="complete-button" disabled={!review} onClick={complete}>Complete review <ArrowRight size={16}/></button></div>
      </aside>
      </div>}
    </main>
  )
}