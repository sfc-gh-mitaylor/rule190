# Agent Trace Review Workbench

Product requirements document. Status: proposed dogfood build. Date: 2026-09-17. Revision: 3.

## 1. Executive summary

Agent owners can inspect individual Cortex Agent traces and run systematic LLM-judged evaluations, but they do not have a coherent way to step into that same quality loop, record what should have happened, and turn their judgment into durable ground truth, evaluators, and agent improvements.

The Agent Trace Review Workbench is a Snowflake-native, focused environment for doing that work. It helps a qualified agent owner review complete tasks, inspect the trajectory with progressive disclosure, judge whether the agent met a defined quality bar, identify the first consequential failure, and state the desired course correction. An embedded CoCo-powered assistant then translates approved human judgment into candidate taxonomy entries, evaluation cases, evaluator specifications, and agent changes. Native Cortex Agent Evaluations remain the execution and scoring engine.

The operating metaphor is redirecting a river. A trace shows the course the agent took. Human review marks the point at which it diverged and defines the preferred channel. CoCo turns that correction into executable artifacts. Subsequent native evaluations test whether the agent now follows the intended course.

This is a dogfood and learning product first. It is intended to make the practice of agent error analysis concrete, develop intuition about traces and evaluation, and test an interaction model. It is not proposed as a competing Snowflake evaluation platform. If the workflow proves useful, its natural destination is the native Agent Evaluations, AI Observability, Agent Studio, and CoCo experience.

### Product thesis

> Help a qualified agent owner discover, define, and operationalize an agent's quality bar by reviewing real execution evidence. Humans establish consequential domain judgment; validated deterministic and model-based evaluators apply that judgment at scale; continuing human audits test whether those evaluators still deserve authority.

### First-order outcome

An agent owner can move through this complete loop without losing provenance:

```text
Trace evidence
  -> human outcome and first consequential failure
  -> desired behavior and course correction
  -> confirmed failure taxonomy and ground truth
  -> candidate evaluator and agent change
  -> human approval
  -> native evaluation against a pinned agent version
  -> disagreement review and further correction
```

## 2. Problem

### 2.1 Current workflow

Snowflake already provides the essential substrate:

- The Snowsight Evaluations UI shows evaluation runs, metric results, thread details, and span-level traces.
- `SNOWFLAKE.LOCAL.GET_AI_EVALUATION_DATA` returns evaluation records and metric output.
- `SNOWFLAKE.LOCAL.GET_AI_RECORD_TRACE` returns the trajectory for one evaluation record.
- `SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS` returns production conversations, spans, and user feedback.
- Native GPA metrics and custom LLM judges score behavior at scale.
- CoCo skills support dataset curation, evaluation, investigation, and optimization.

The workflow breaks between inspection and correction. A reviewer can see what happened but cannot remain in the same flow to:

- Make an independent, structured judgment.
- Anchor a failure to the first consequential step.
- Record what the agent should have done instead.
- Reuse a confirmed issue tag without repeating analysis.
- Discover and govern an application-specific failure taxonomy.
- Promote a reviewed production trace into an evaluation case.
- Test an LLM judge against trusted human labels.
- Translate a correction into a proposed agent, tool, skill, or semantic-model change.
- Preserve lineage across the observation, proposal, approval, application, and evaluation result.

Today this work typically spills into notes, spreadsheets, notebooks, one-off Streamlit apps, YAML, and separate CoCo sessions. Context is lost and the owner must repeatedly reconstruct the task.

### 2.2 Why LLM judging alone is insufficient

LLM judges are necessary for scale. They are not a substitute for discovering what matters in a particular domain. A judge can consistently apply a known rubric while still missing a consequential failure absent from that rubric. It can also exhibit self-enhancement bias, criteria ambiguity, model drift, and uneven false-negative rates.

The Workbench does not compete with LLM-as-a-judge. It supplies the disciplined human evidence needed to create, calibrate, audit, and improve judges.

### 2.3 Governing evaluation premise

The product adopts the error-analysis approach articulated by Hamel Husain and Shreya Shankar:

1. Error analysis precedes evaluator construction.
2. A qualified domain expert performs initial open coding.
3. The reviewer starts with diverse traces rather than only obvious failures.
4. The reviewer records the first upstream or consequential failure because later failures often cascade from it.
5. Free-form observations precede machine-proposed taxonomy during discovery.
6. Axial coding groups observations into a failure taxonomy; an LLM may assist, but a human confirms the taxonomy.
7. Application-specific evaluators emerge from observed and confirmed failure modes.
8. LLM judges are validated on held-out, human-labeled examples with both positive and negative cases.
9. Review continues until additional traces stop materially changing the taxonomy, rather than until an arbitrary annotation quota is reached.
10. Progressive disclosure keeps long traces readable by collapsing boilerplate and large tool outputs.

## 3. Product principles

| Principle | Requirement |
|---|---|
| Human discovery, machine scale | Humans discover and define consequential quality criteria; automation applies approved criteria broadly. |
| Comprehension before throughput | The interface first makes the end task and trajectory understandable. Speed optimizations must not obscure causality. |
| One evidence chain | Observation, label, correction, generated artifact, approval, and evaluation result remain linked. |
| Facts are not interpretations | Source telemetry, human judgment, and machine suggestions are stored and displayed separately. |
| First failure first | Review anchors the earliest consequential divergence before downstream symptoms. |
| Progressive disclosure | Boilerplate, successful low-information spans, and large payloads are collapsed by default. |
| Suggestions earn visibility | Machine quality suggestions remain hidden during initial open coding and become proactive during synthesis. |
| Clustering is triage | Similarity organizes attention; it does not determine quality or prevalence. |
| Native systems remain authoritative | The Workbench consumes native traces and produces artifacts for native Agent Evaluations and CoCo. |
| Reversible assistance | CoCo proposes typed changes; a human approves them; deterministic application code performs the mutation. |
| Populations stay distinct | Production trace prevalence and curated evaluation-set performance are never combined as one statistic. |
| Workflow over feature count | Optimize the time and fidelity from observed failure to tested correction; do not accumulate disconnected eval features. |
| Open contracts over proprietary workflow | Use Snowflake-native objects and ordinary relational/JSON contracts so reviews, labels, and results remain analyzable outside the UI. |
| Reuse before invention | Borrow proven annotation, experiment, comparison, and judge-validation patterns; custom-build only the Snowflake-specific course-correction experience. |

## 4. Users and jobs to be done

### 4.1 Primary user: quality owner

The primary user is a qualified agent owner or PM accountable for whether an agent meets a specific quality bar. They understand the intended user outcome and either possess the required domain expertise or enlist a qualified reviewer for domain-specific criteria.

Responsibilities:

- Define what good means for the agent.
- Understand failures in actual trajectories, not only final answers.
- Maintain representative evaluation cases.
- Decide which failures warrant evaluators or agent changes.
- Determine whether an evaluator is trustworthy enough to operate at scale.
- Approve changes to the quality bar and production agent behavior.

### 4.2 Jobs to be done

| Situation | Job |
|---|---|
| I have a new or materially changed agent | Help me review a diverse set of real traces so I can discover how it actually fails. |
| A task produced a bad outcome | Help me find the first consequential divergence without reading repetitive telemetry. |
| I recognize a known failure | Let me apply an approved tag and advance within seconds. |
| I find an unfamiliar issue | Let me record an open observation without forcing it into a premature taxonomy. |
| Several observations look related | Help me synthesize them into a precise, governed failure definition. |
| I know what should have happened | Help me turn that correction into ground truth and expected tool behavior. |
| I want to automate detection | Help me draft and validate a deterministic or LLM evaluator against my labels. |
| A judge disagrees with me | Show the evidence, rubric, and explanation so I can diagnose the disagreement. |
| I want to improve the agent | Translate confirmed failures into reviewable configuration changes and verify them on a clone or committed version. |

### 4.3 Secondary future users

- Domain reviewers who apply owner-defined quality criteria.
- Adjudicators resolving reviewer disagreement.
- Agent engineers implementing approved corrections.
- Governance and risk reviewers auditing evidence and approvals.

### 4.4 Non-personas for the first build

- End users seeking answers from the agent.
- Executives seeking a portfolio dashboard.
- Generic label-workforce administrators.
- Model researchers benchmarking foundation models.

## 5. Scope and boundaries

### 5.1 Full product program

The complete program includes:

- Governed access to evaluation and production traces.
- Normalized, paginated trace presentation.
- Discovery and deep-dive review queues.
- Task, dimension, criterion, failure-span, tag, and note capture.
- Taxonomy synthesis and versioning.
- Course-correction composition.
- Production-trace promotion into evaluation datasets.
- Evaluator drafting, calibration, approval, and monitoring.
- Native evaluation execution and comparison.
- CoCo-assisted change proposals.
- Future collaborative review and adjudication.

### 5.2 V1

V1 comprises milestones M0 through M5 and proves the complete human review, course-correction, and judge-calibration hypothesis:

- One quality owner per agent.
- Evaluation and production queues kept separate.
- Discovery and deep-dive review modes.
- Three-state overall and dimensional judgments.
- First consequential failure selection.
- Confirmed tags and open observations.
- Desired-behavior capture.
- Autosave and complete audit provenance.
- Separate synthesis workspace with CoCo-assisted pattern proposals.
- Promotion of approved corrections into candidate evaluation records.
- Read-only integration with native evaluation metrics and judge explanations.
- A staged, native-compatible evaluation-case publication flow.
- Deterministic and custom-judge drafting against frozen human label sets.
- Calibration reporting and trace-level disagreement review.

M6 and M7 are post-V1. V1 may propose an agent change but does not apply or validate agent configuration changes as part of its release gate.

### 5.3 Explicit non-goals for V1

- Replacing Snowsight Agent Evaluations or AI Observability.
- Reimplementing agent execution or native evaluation scoring.
- Automatic modification of production agents.
- Automatic acceptance of LLM-proposed labels or taxonomy entries.
- Crowdsourced annotation management.
- Multi-reviewer adjudication UI.
- A cross-agent leaderboard.
- Claiming production prevalence from a curated evaluation set.
- Fine-tuning a judge model directly from every annotation.
- Supporting every OpenTelemetry producer in the first release.
- Applying agent configuration changes or operating a continuous production-scoring service.

## 6. Information architecture

| Area | Purpose |
|---|---|
| Work queue | Resume active reviews and start a production or evaluation review session. |
| Discovery session | Review a diverse sample with cluster identities de-emphasized. |
| Deep-dive investigation | Review similar traces against a known hypothesis or confirmed failure. |
| Trace workspace | Understand the task, inspect the trajectory, judge quality, and record a correction. |
| Synthesis | Group open observations, refine definitions, and govern the taxonomy. |
| Quality bar | Define universal dimensions and versioned agent-specific criteria. |
| Course corrections | Review desired behavior and generated evaluation or agent-change artifacts. |
| Evaluator lab | Draft, calibrate, approve, compare, and retire evaluators. |
| Quality overview | Track coverage, disagreements, quality trends, and unresolved work without replacing native run views. |

### 6.1 Core object model

The interface uses five familiar evaluation objects rather than inventing new abstractions for established workflows:

| Object | Meaning in the Workbench | Native relationship |
|---|---|---|
| Trace | Immutable evidence from one agent turn and its spans | Agent Evaluations or Observability UDTF output |
| Review queue | An ordered set of trace or comparison assignments with a rubric | Workbench selection metadata over native trace references |
| Dataset | A versioned set of inputs, expected behavior, and metadata | Snowflake evaluation dataset or staged source table |
| Experiment | A pinned agent version run over a pinned dataset with pinned evaluators | Native Agent Evaluation run |
| Evaluator | A versioned deterministic check, native GPA metric, or custom LLM judge | Native metric or Workbench-managed specification |

The Workbench adds only the objects not supplied coherently by the native substrate: human review, evidence anchor, taxonomy, course correction, calibration set, and assistant proposal.

## 7. Review workflows

### 7.1 Shared review sequence

Every trace review follows the same core sequence:

```text
Understand task
  -> judge overall outcome
  -> assess applicable dimensions and custom criteria
  -> if failed or unclear, select first consequential failure span
  -> apply known tag or write open observation
  -> state desired behavior when known
  -> commit human judgment
  -> optionally reveal machine judgments
  -> advance
```

The reviewer may save an incomplete draft. Completion requirements are explicit:

| Outcome | Required to complete | Optional |
|---|---|---|
| `Met bar` | Applicable dimension and custom-criterion results | Positive note, representative evidence |
| `Did not meet bar` | Applicable criterion results, first consequential failure or `Missing or unobservable step`, and a confirmed tag or open observation | Desired behavior, secondary findings |
| `Unclear` | Applicable criterion results and an uncertainty reason: `missing evidence`, `ambiguous quality bar`, `insufficient domain expertise`, or `other` | Suspected span, note, desired evidence |

`Unclear` does not require a failure span because uncertainty may arise from missing evidence or an inadequate rubric. It is excluded from binary evaluator labels until resolved.

### 7.2 Discovery mode

Purpose: find unknown failure modes and build agent intuition.

Requirements:

- Draw traces across task-intent clusters, tool trajectories, agent versions, operational extremes, feedback states, and small clusters.
- Do not reveal semantic cluster names before initial judgment.
- Do not show LLM quality scores, explanations, or proposed failure categories before the reviewer commits an initial observation.
- Permit factual assistance such as decoding a payload or explaining what a tool does, but label it as machine assistance.
- Prefer open observations for novel failures.
- Track discovery yield and saturation without pressuring the reviewer to maximize volume.

### 7.3 Deep-dive mode

Purpose: validate a known failure, measure its match rate within an explicitly selected queue, and collect examples.

Requirements:

- Group similar traces using mixed signals.
- State the queue hypothesis and selection rule.
- Show existing tags and relevant approved evaluator output.
- Allow one-action application of recently used confirmed tags.
- Keep an escape action for `Different issue` so the hypothesis does not force classification.
- Distinguish denominator: all traces matching the queue rule, not all production traffic.
- Use the word `prevalence` only when the queue represents a declared population selected probabilistically with known inclusion probabilities, weighting, coverage limits, and confidence intervals.

### 7.4 Evaluation and production queues

| Queue | Characteristics |
|---|---|
| Evaluation | Controlled input, named dataset and run, pinned agent version where possible, repeatable comparison. |
| Production | Actual demand, changing data, user and permission context, feedback bias, version drift, potentially incomplete telemetry. |

The app must never merge their rates. A reviewed production trace may be promoted into a future evaluation case after the owner defines stable expected behavior.

### 7.5 Judgment model

The common scale is:

- `Met bar`
- `Did not meet bar`
- `Unclear`
- `Not applicable` for individual dimensions or criteria only

Universal dimensions:

| Dimension | Question | GPA alignment |
|---|---|---|
| Decision quality | Did the agent choose a sound plan and appropriate tools for the goal? | Goal to Plan |
| Execution quality | Were actions, inputs, and interpretations correct? | Plan to Action |
| Final response quality | Did the delivered answer or action meet the user's goal? | Action to Goal |

Agent-specific criteria are versioned, three-state checks such as:

- Used only approved semantic views.
- Cited the source used for a material conclusion.
- Refused requests outside the agent's authorized scope.
- Preserved a required approval step before a write action.

The custom taxonomy sits beneath GPA rather than replacing it.

### 7.6 First consequential failure

If the outcome is `Did not meet bar`, the reviewer must identify the earliest span whose correction would plausibly have prevented or materially changed the bad outcome. If no span is visible, the reviewer can select `Missing or unobservable step`. If failures are independent, later ones may be attached as secondary findings, but they are not required in V1.

### 7.7 Known and novel issues

Known issue path:

1. Select the failure span.
2. Open the searchable tag command menu.
3. Apply a confirmed tag.
4. Add an optional note or desired behavior.
5. Advance.

Novel issue path:

1. Select the failure span.
2. Write a free-form observation in the reviewer's own language.
3. Optionally state desired behavior.
4. Do not require a taxonomy choice.
5. Advance.

Existing confirmed tags remain searchable but are not shown as a permanent checklist. This supports fast classification without framing every discovery.

### 7.8 Comparative review

M5 adds pairwise review for cases where an absolute label is difficult or a correction must be validated against a baseline:

- Compare exactly two executions of the same dataset case, normally baseline and candidate agent versions.
- Randomize left/right placement and hide version identity until the reviewer commits a preference.
- Allow `A better`, `B better`, `Equivalent`, and `Cannot determine` for each rubric criterion.
- Show input, expected behavior, outputs, and trace differences side by side with unchanged boilerplate collapsed.
- Preserve an absolute quality judgment separately; a candidate can be better than baseline and still fail the bar.
- Store pairwise judgments as first-class review records linked to both native evaluation runs.

Pairwise review borrows a mature annotation pattern used by existing evaluation tools. The Workbench need only adapt it to agent trajectories and Snowflake version/run identity.

## 8. Trace workspace UX

### 8.1 Layout

The primary screen is a quiet three-region workspace:

```text
+----------------+--------------------------------------+----------------------+
| Queue          | Task and trajectory                  | Judgment             |
|                |                                      |                      |
| 12 of 40       | User goal                            | Overall outcome      |
| progress       | Agent response                       | Dimensions           |
| trace list     |                                      | Custom criteria      |
| filters        | v Plan decision                      | Failure tag/note     |
|                | > Retrieval boilerplate              | Desired behavior     |
|                | v Tool call with anomaly             |                      |
|                | > Large output                       | Saved automatically  |
+----------------+--------------------------------------+----------------------+
```

The central canvas receives the largest width. The queue rail can collapse. The judgment pane remains visible while the trajectory scrolls.

### 8.2 Task-first presentation

Before span details, show:

- User request and relevant conversation context.
- Final agent answer or action.
- Agent version and trace provenance.
- Errors, duration, tool count, and user feedback as compact metadata.
- Ground truth only when the review mode permits it.

The reviewer must understand the task before inspecting implementation details.

### 8.3 Progressive disclosure

Default-open:

- Planning and decision spans.
- Failed or warning spans.
- Tool calls with unusual duration, retries, or empty results.
- The selected first-failure span.
- Response generation when final response quality failed.

Default-collapsed:

- Successful authentication and setup events.
- Repetitive low-information spans.
- Large retrieval and SQL results.
- Token and low-level telemetry details.

Every collapsed row shows enough summary to decide whether to open it: span type, action, status, duration, input/output shape, and anomaly indicators.

### 8.4 Interaction requirements

- Keyboard navigation for previous/next trace, outcome selection, tag menu, save, and expand/collapse.
- Optimistic autosave with visible `Saving`, `Saved`, and `Conflict` states.
- Prefetch the preceding and following trace summaries and the next trace body.
- Preserve expansion state and scroll position when opening the assistant or moving between panes.
- Virtualize long span lists and truncate payload rendering until expanded.
- Warn before leaving only when a required draft field has not reached the server.
- Support undo for the last completed review.
- Never hide a redaction or missing event; render it explicitly.
- Provide in-trace search across span names and currently authorized payload text.

### 8.5 Degraded and conflict states

- **Partial trace:** show which event classes or time ranges are missing and permit `Unclear: missing evidence`.
- **Expired source:** retain the durable review-evidence snapshot and disable unsupported source expansion.
- **Access revoked:** immediately stop serving cached source content; preserve the review draft without exposing evidence the caller can no longer read.
- **Stale queue item:** mark agent/source-version divergence and require refresh or explicit review of the captured snapshot.
- **Source changed:** display the reviewed snapshot and latest source as distinct versions; never merge them silently.
- **Save conflict:** retain both drafts, show the changed fields, and require explicit resolution.
- **Assistant timeout/error:** allow cancel and retry while preserving review state; all manual paths remain available.
- **Oversized or malformed payload:** render a safe bounded preview and offer server-side authorized search rather than loading the full value into the browser.

### 8.6 Accessibility

- Complete keyboard operation and logical focus order.
- Visible focus treatment and no color-only judgment states.
- Accessible names for span controls and status icons.
- Resizable panes with a single-column fallback below desktop width.
- Monospace payloads with wrapping controls and copy actions.

### 8.7 The failure table

After review, the primary analytical output is a configurable table rather than a dashboard of aggregate scores. It combines one row per reviewed task with:

- Task and source population.
- Agent, dataset, run, and evaluator versions.
- Human outcome and dimensional judgments.
- First consequential failure and evidence link.
- Confirmed tags or unresolved observation.
- Desired behavior and course-correction state.
- Native and custom evaluator predictions.
- Human-judge disagreement status.

The table supports saved views, sorting, filtering, grouping, bulk queue creation, column selection, and export to a Snowflake table/view or ordinary JSON/CSV where policy permits. Every aggregate links back to the contributing traces. This is the Workbench equivalent of Braintrust's actionable failure table and prevents aggregate metrics from hiding the cases that produced them.

## 9. Sampling and similarity

### 9.1 Mixed-signal representation

Similarity is not one opaque embedding. The system records separate signals:

| Signal | Use |
|---|---|
| Task-intent embedding | Group traces attempting similar user outcomes. |
| Tool/skill trajectory | Group traces taking similar execution paths. |
| Objects touched | Identify common semantic views, search services, tables, and procedures. |
| Operational features | Surface extremes in latency, retries, token use, depth, and error status. |
| Agent metadata | Preserve version, alias, model, and configured-tool context. |
| Review evidence | Find traces similar to confirmed tags and free-form observations. |

The UI must expose the reason a trace entered a queue: for example, `task similarity`, `same failed skill`, or `latency outlier`.

### 9.2 Discovery sampling

Discovery sampling should:

- Establish a random baseline.
- Stratify across high-level task-intent clusters.
- Oversample small clusters enough to expose edge cases.
- Include both high and low automated scores when available.
- Include traces without explicit user feedback.
- Include a controlled number of outliers.
- Avoid presenting contiguous groups from one cluster.

Cluster identifiers remain de-emphasized until the review is committed. The reviewer can inspect selection rationale afterward.

### 9.3 Deep-dive sampling

Deep-dive queues may be created from:

- A confirmed taxonomy tag.
- Semantic similarity to selected observations.
- A tool or skill sequence.
- A Snowflake object or semantic view.
- A judge prediction or disagreement.
- A production feedback signal.
- A version or time window.

Every queue stores its immutable selection expression and creation timestamp.

## 10. Synthesis and taxonomy governance

### 10.1 Separate synthesis workflow

Synthesis happens after a body of independent reviews. CoCo may:

- Suggest groups of semantically related observations.
- Name a candidate failure mode.
- Show representative and contradictory examples.
- Identify overlap with existing confirmed tags.
- Recommend merge, split, or refinement.
- Find unreviewed traces likely to contain the proposed failure.

The owner can accept, edit, merge, split, reject, or defer each suggestion. No suggestion becomes a confirmed tag automatically.

### 10.2 Taxonomy entry

Each confirmed failure mode contains:

- Stable identifier.
- Human-readable name.
- Precise binary definition.
- One or more GPA dimension mappings.
- Inclusion criteria.
- Exclusion and boundary cases.
- Severity and business consequence.
- Positive and negative examples.
- Owner, version, status, and approval timestamp.

Lifecycle:

```text
Proposed -> Confirmed -> Revised -> Deprecated
```

Rename preserves identity. Merge and split produce explicit lineage. Historical labels remain tied to the taxonomy version used at review time and are not silently rewritten. The system may generate a reclassification queue when a material definition changes. A `cross-cutting` mapping is allowed only with an owner-authored justification and does not replace the more specific GPA mappings that apply.

### 10.3 Theoretical saturation

The synthesis view charts the number of new or materially revised failure modes by review sequence. Twenty consecutive diverse reviews without a material taxonomy change is a configurable prompt to inspect saturation, not proof of it. Stopping requires the owner to record a rationale after reviewing diversity coverage, discovery-yield trend, unresolved observations, and representation of small clusters.

## 11. CoCo-powered course correction

### 11.1 Role

CoCo is embedded as a contextual agent in the Workbench, not presented through Desktop or CLI. The intended implementation uses a hosted Coding Agent through the Cortex Agents API with `code_toolset_all`, or a narrower hosted agent configuration where full coding tools are unnecessary. The local Cortex Code Agent SDK is not the deployment path because it depends on a local CLI process and local connection configuration.

CoCo translates judgment into machinery. It does not manufacture the judgment used to validate that machinery.

### 11.2 Interaction forms

CoCo appears through three interaction models:

1. **Contextual actions** attached to a trace or span, such as `Explain this decision`, `Compare expected and actual`, `Find similar traces`, and `Summarize this output`.
2. **Synthesis assistant** that groups observations and proposes taxonomy changes after human review.
3. **Course-correction composer** that converts an approved finding into typed candidate artifacts.

A generic chat drawer is available as an escape hatch, but it is not the primary interaction.

### 11.3 Assistance by mode

| Mode | Allowed behavior |
|---|---|
| Discovery | Explain mechanics on request; do not reveal unsolicited quality judgments or categories before commitment. |
| Deep dive | Show the known hypothesis and approved evaluator evidence; accelerate known-tag application. |
| Synthesis | Proactively propose groupings, definitions, examples, and related traces. |
| Calibration | Explain disagreements and draft evaluator refinements. |
| Optimization | Propose agent, tool, skill, or semantic-model changes and evaluation plans. |

### 11.4 Course-correction object

```yaml
correction_id: <uuid>
source:
  trace_source: evaluation | production
  record_id: <record-id>
  trace_id: <trace-id>
  span_id: <first-failure-span-id>
human_judgment:
  outcome: did_not_meet_bar
  taxonomy_version: 7
  confirmed_tags:
    - semantic_view_resolution_failure
  observation: <reviewer-authored text>
desired_behavior:
  decision: Use the approved finance semantic view
  expected_tool: FINANCE_ANALYST
  expected_result: <plain-language requirement>
proposed_artifacts:
  - evaluation_ground_truth
  - evaluator_example
  - agent_instruction_change
status: human_approved
```

### 11.5 Trace-to-experiment handoff

The shortest route from a finding to a tested correction is a first-class workflow:

1. Start from the reviewed trace with its evidence and desired behavior already populated.
2. Promote it into a staged dataset candidate without re-entering the input or expected behavior.
3. Ask CoCo to propose a correction artifact, such as an instruction or evaluator change.
4. Preview and edit the proposal in context.
5. Select a pinned dataset, agent version, and evaluator set.
6. Launch or deep-link to the native evaluation run.
7. Return to a side-by-side baseline/candidate comparison on the same case and aggregate experiment.

The handoff must preserve a breadcrumb back to the source trace and forward to the resulting experiment. It should not become a generic prompt playground in V1: Cortex Agent configuration can span instructions, tools, skills, and semantic views, so changes are represented as typed, versioned proposals rather than one monolithic prompt text box.

### 11.6 Approval boundary

CoCo never directly mutates annotations, taxonomy, evaluation datasets, or agent specifications.

1. CoCo emits a typed proposal with evidence and rationale.
2. The app renders a structured preview or diff.
3. The owner accepts, edits, rejects, or defers it.
4. Deterministic application logic applies the approved transaction.
5. Audit history records proposal, human decision, applied artifact, and result separately.

Agent changes target a clone or new committed version, never a production live specification directly.

### 11.7 Untrusted trace-content boundary

Trace content is untrusted input. User prompts, retrieved documents, tool output, SQL comments, and error messages can contain instructions intended to redirect the embedded agent.

- Inject trace material as delimited evidence, never as agent instructions.
- Use a mode-specific tool allowlist. Review and synthesis modes receive read-only trace and annotation retrieval tools, not shell, file mutation, network, or unrestricted SQL tools.
- Prefer a narrow hosted Cortex Agent over `code_toolset_all` when the task does not require coding tools.
- Require structured output validated against a versioned JSON schema for synthesis and course-correction proposals.
- Cap trace context, model turns, tokens, execution time, and per-session cost.
- Do not permit assistant-fetched external content in trace analysis.
- Test adversarial trace payloads, indirect prompt injection, malformed JSON, and oversized content before V1 exit.
- Treat assistant failure as non-blocking: review and manual annotation must remain usable when CoCo is unavailable.

## 12. Evaluation and judge lifecycle

### 12.1 Concert, not competition

Human review and LLM judging have distinct responsibilities:

| Human review | LLM judge |
|---|---|
| Discovers unknown consequential failures. | Applies a known failure definition at scale. |
| Defines and changes the quality bar. | Scores against a versioned quality bar. |
| Resolves ambiguity and boundary cases. | Prioritizes likely failures and disagreement. |
| Produces trusted labels. | Is calibrated and audited against trusted labels. |
| Diagnoses root cause. | Finds more cases matching known patterns. |

### 12.2 Evaluator creation

For each confirmed failure mode:

1. Confirm a precise binary definition and important boundary cases.
2. Select trusted human-labeled pass and fail examples.
3. Prefer a deterministic evaluator when an objective rule can express the failure.
4. Otherwise draft a custom LLM judge prompt and structured output contract.
5. Separate development/calibration examples from a held-out validation set.
6. Run predictions under a pinned evaluator and model version.
7. Compare predictions with human labels.
8. Inspect every high-consequence false negative and a representative set of other disagreements.
9. Revise definition, labels, prompt, or threshold as appropriate.
10. Approve the evaluator for an explicit agent, taxonomy version, and task distribution.

The machine that proposes an evaluator may not label its own validation set.

### 12.3 Human label-set governance

- Label-set membership is frozen and versioned before calibration begins.
- `Unclear`, missing-evidence, and unresolved taxonomy-boundary cases are excluded from binary labels and retained in a resolution queue.
- Changes to a human label create a new label version with reviewer, reason, and timestamp; prior calibration results remain reproducible.
- Development examples and held-out validation examples must not share the same source trace, paraphrase family, or synthetic ancestor.
- The owner performs a blind repeat-label audit on a sample to measure personal consistency.
- High-consequence criteria and disputed labels require a second qualified reviewer before evaluator approval.
- Calibration reports disclose reviewer count, repeat-label agreement, exclusions, class balance, and any adjudication.

### 12.4 Evaluator states

```text
Draft -> Calibrating -> Approved -> Monitoring -> Degraded -> Retired
```

Approval is organizational and scoped, not Snowflake certification. Built-in GPA metric versions remain Snowflake-owned; the Workbench can audit their local suitability but cannot redefine them. Custom metrics and deterministic evaluators can carry a local approval status.

### 12.5 Required calibration measures

- True-positive rate and false-negative rate.
- True-negative rate and false-positive rate.
- Balanced accuracy.
- Precision where class prevalence is meaningful.
- Human-judge agreement.
- Confusion matrix by task cluster and agent version.
- Sample size and class balance.
- Confidence intervals where the sample supports them.
- Cost and latency per scored trace.

Numeric correlation alone is insufficient for binary consequential failures. Approval thresholds are criterion-specific. High-severity safety or authorization failures require stricter false-negative thresholds than style preferences.

### 12.6 Judge operation queues

Approved evaluators create, but do not resolve, review work:

- Likely known failures.
- Low-confidence or inconsistent predictions.
- Human-judge disagreements.
- Random samples of predicted passes for false-negative audit.
- Distribution-shift samples involving new tasks, tools, objects, or versions.
- Traces not covered by any approved evaluator.

In discovery mode, judge output is revealed only after human commitment. In a named deep dive, the hypothesis may be visible from the start.

### 12.7 Evaluator monitoring

An evaluator returns to `Calibrating` or `Degraded` when:

- Its taxonomy definition changes materially.
- The judge model or prompt version changes.
- The agent adds a material tool, skill, or task family.
- Continuing audit exceeds the allowed false-negative or disagreement threshold.
- The reviewed production distribution moves beyond calibrated clusters.

### 12.8 Reuse policy for evaluator tooling

The Workbench should orchestrate or adapt mature evaluator components rather than implement every metric from scratch.

| Need | Preferred source |
|---|---|
| Native end-to-end agent scoring | Cortex Agent GPA and custom metrics |
| Deterministic checks | Small Snowflake SQL/JavaScript/Python functions with explicit contracts |
| Judge classification metrics | Established confusion-matrix and classification implementations |
| Prompt optimization from expert labels | Evaluate Evidently's open-source optimizer before writing a custom search loop |
| Generic RAG or text evaluators | Evaluate TruLens, Evidently, and Phoenix implementations where their licenses and runtime fit |
| Experiment repetitions and comparison | Native repeated/versioned evaluation runs where available |

Any reused library is an interchangeable execution adapter. Snowflake tables retain canonical labels, splits, evaluator definitions, predictions, and audit records. V1 must not deploy a second tracing backend, hosted vendor control plane, proprietary query language, or external data store.

Automated prompt optimization is allowed only after the human-defined criterion and frozen splits exist. Candidate prompts are evaluated on training and validation data; the untouched test split is used once for final approval. Expert comments are retained as signal-rich training evidence but cannot be copied into held-out judge inputs.

## 13. Snowflake data architecture

### 13.1 Source systems

| Source | Purpose |
|---|---|
| `GET_AI_EVALUATION_DATA` | Named evaluation records, ground truth, native/custom metric scores, and judge explanations. |
| `GET_AI_RECORD_TRACE` | Ordered spans for one evaluation record. |
| `GET_AI_OBSERVABILITY_EVENTS` | Production threads, traces, spans, and user feedback. |

Native telemetry is immutable evidence. The Workbench stores references and derived snapshots; it never writes to `SNOWFLAKE.LOCAL.AI_OBSERVABILITY_EVENTS`.

### 13.2 Logical entities

| Entity | Grain and purpose |
|---|---|
| `TRACE_INDEX` | One row per source trace/turn; searchable metadata and source pointers. |
| `TRACE_SPAN_CACHE` | One row per fetched span; bounded cache for responsive rendering. |
| `TRACE_FEATURES` | One row per trace and feature version; embeddings, trajectory, objects, and operational features. |
| `REVIEW_SESSION` | One reviewer session with mode, source population, rubric version, and sampling policy. |
| `REVIEW_QUEUE_ITEM` | One selected trace per session with immutable selection rationale and order. |
| `HUMAN_REVIEW` | One review attempt per trace, reviewer, and rubric version. |
| `REVIEW_CRITERION_RESULT` | One human result per review and criterion. |
| `FAILURE_EVIDENCE` | One anchored finding per review and span. |
| `COURSE_CORRECTION` | One desired-behavior statement and its lifecycle. |
| `TAXONOMY_TAG` | Stable failure identifier. |
| `TAXONOMY_TAG_VERSION` | Versioned definition, examples, boundaries, and status. |
| `REVIEW_TAG_ASSIGNMENT` | Link from review evidence to the tag version used at the time. |
| `RUBRIC` / `RUBRIC_VERSION` | Agent quality bar and immutable versions. |
| `RUBRIC_CRITERION_VERSION` | Versioned universal or agent-specific criterion. |
| `EVALUATION_CASE_CANDIDATE` | Reviewed trace proposed for promotion to a native dataset. |
| `EVALUATOR` / `EVALUATOR_VERSION` | Deterministic or model-based evaluator definition and scope. |
| `HUMAN_LABEL_SET` | Frozen calibration or validation membership. |
| `JUDGE_PREDICTION` | One evaluator-version prediction per trace. |
| `CALIBRATION_RUN` | Aggregate calibration result and thresholds. |
| `ASSISTANT_PROPOSAL` | Immutable CoCo proposal with type, evidence, and structured payload. |
| `APPLIED_ARTIFACT` | Approved dataset, YAML, agent version, or other resulting object. |
| `AUDIT_EVENT` | Append-only record of human and system state transitions. |

### 13.3 Durable review-evidence snapshot

Every completed review stores an immutable, authorized evidence snapshot sufficient to understand the judgment if the source later expires. The snapshot contains:

- Source account, region, source function, agent FQN and version, run/thread/record/request/trace/span identifiers, and source timestamps.
- User task, final response, selected failure-span summary, and only the payload excerpts explicitly cited by the reviewer.
- Redaction state, content hashes, source observation time, and snapshot creation time.
- Rubric, criterion, and taxonomy versions used by the reviewer.

The snapshot is not a wholesale copy of the trace. It follows an explicit retention policy, retains original redactions, and cannot be used to bypass current authorization. A review cannot be completed if the minimum snapshot cannot be written. Completed reviews require 100% identifier and evidence-snapshot lineage.

### 13.4 Identifier and ingestion rules

- Canonical source keys include organization/account locator, region, source adapter and source type, agent FQN, and source identifiers. Never assume `record_id`, `request_id`, or `trace_id` is globally unique.
- Preserve source `record_id`, `request_id`, `trace_id`, `span_id`, resolved version, run name, and source timestamps.
- Record ingestion watermark, first/last observed time, payload hash, source snapshot version, and adapter version.
- Deduplicate identical compound keys and payload hashes. A changed payload creates a new source snapshot rather than overwriting reviewed evidence.
- Late-arriving events update the trace index and mark affected incomplete reviews as stale; completed reviews retain their evidence snapshot and may be queued for re-review.
- Assign Workbench UUIDs independently.
- Every review records the rubric and taxonomy versions visible at judgment time.
- Every judge prediction records evaluator definition, prompt, model, threshold, and input snapshot versions.
- Every promoted case links back to the human review and source trace.
- Every applied agent change links to its proposal, approval, target clone/version, and validation run.

### 13.5 Caching and retention

- `TRACE_INDEX` stores minimum searchable metadata and can be refreshed incrementally.
- Full span payloads are fetched on demand and cached with an expiry appropriate to dogfood use.
- Annotation and audit records are durable until explicitly deleted under policy.
- Cached source content follows the stricter of source retention and Workbench retention.
- Deleting source access does not grant continued access through the cache; reads must enforce current authorization.
- Redacted source fields remain redacted in all derived views and assistant prompts.

### 13.6 Evaluation-case publication contract

V1 publishes through a staged flow:

```text
Candidate -> Validated -> Approved -> Published -> Superseded
                         \-> Rejected
```

The candidate stores `query_text` and a `ground_truth` VARIANT compatible with native Cortex Agent evaluation datasets. Ground truth may include `ground_truth_output`, `ground_truth_invocations`, and namespaced custom-criterion evidence. Validation checks schema, required fields, duplicate source/correction lineage, absolute time scope where needed, and reviewer approval. Publication writes to a versioned source table for inspection and creates or references a new native dataset version; V1 never appends invisibly to an existing frozen evaluation dataset. Operations use an idempotency key derived from correction, candidate version, and target dataset. Rejection and supersession preserve history; rollback selects the prior dataset version rather than deleting provenance.

### 13.7 Background processing

Asynchronous jobs compute embeddings, normalized trajectories, object extraction, cluster assignments, CoCo synthesis, evaluator runs, and calibration aggregates. Jobs must be idempotent by input and version keys and expose status without blocking trace review.

## 14. Application architecture decision

### 14.1 Decision

Build the dogfood surface as a Next.js Snowflake App on Snowflake App Runtime. Treat it as an incubation and learning surface, not the asserted long-term product home.

### 14.2 Alternatives

| Option | Benefits | Problems | Decision |
|---|---|---|---|
| Streamlit in Snowflake | Fastest build, embedded Snowflake session, low operations. | Rerun model, focus loss, weaker keyboard/state interactions, limited virtualization, visually constrained review workstation. | Reject for primary UX. |
| Streamlit plus React component | Snowflake shell with a richer central component. | Two state models; component becomes most of the product; packaging and debugging complexity. | Reject unless App Runtime is blocked. |
| Next.js Snowflake App | Precise layout, client state, prefetch, virtualized traces, optimistic writes, streaming assistant, caller's rights. | More engineering and deployment surface. | Select for dogfood. |
| External application | Maximum flexibility. | Additional identity, data movement, governance, and operations. | Reject. |

### 14.3 Runtime design

- Next.js renders the client workspace and server API routes.
- Client components own ephemeral layout, expansion, keyboard, optimistic mutation, and assistant-stream state.
- API routes issue parameterized Snowflake queries and enforce authorization.
- Caller’s rights are used for native trace reads and user-scoped annotation access.
- Owner’s rights may be used only for shared application metadata that all authorized users may see.
- Long trace queries and asynchronous jobs use long-running server paths rather than blocking client transitions.
- Adjacent trace summaries and bodies are prefetched.
- Large payloads and span lists are paginated or virtualized.
- The application makes no external data calls and exports no trace content outside Snowflake.

### 14.4 Embedded CoCo architecture

Use the hosted Cortex Agents REST API for an object-based or inline Coding Agent. The application streams server-sent events into contextual actions and the synthesis/composer views. Tool permissions default to approval-gated behavior. Prefer narrow tools and read-only access during review; do not use unrestricted `always_allow` for state mutation.

The application, not CoCo, applies approved typed changes. This avoids using free-form agent tools as the transaction layer.

### 14.5 Product integration stance

The app must not duplicate native run management more than required for the learning loop. It should deep-link to native run views where practical and produce native-compatible dataset and metric artifacts. Components and data contracts should be documented so successful interaction patterns could later move into Snowsight Agent Evaluations or Agent Studio.

### 14.6 Build, borrow, and defer

| Capability | Decision | Rationale |
|---|---|---|
| Snowflake trace ingestion and authorization | Build thin adapters | Account-local UDTFs, redaction, and caller's-rights semantics are Snowflake-specific. |
| Task-first trajectory reader | Build | First-consequential-failure review across Cortex Agent spans is the core UX hypothesis. |
| Review queue mechanics | Borrow pattern, build adapter | Queue progress, keyboard labeling, assignments, and saved views are established patterns. |
| Trace/dataset/experiment/evaluator concepts | Reuse | These are mature industry and Snowflake-native objects. |
| Failure table | Borrow pattern, build on Snowflake | The actionable row-level table is more useful than inventing another dashboard abstraction. |
| Pairwise experiment comparison | Borrow pattern | LangSmith, Braintrust, and Phoenix demonstrate the pattern; adapt to native run identity. |
| Generic prompt playground | Defer | Native agent corrections are broader than prompt text and CoCo already owns optimization workflows. |
| Trace storage backend | Do not build | Native AI Observability remains authoritative. |
| Generic evaluator library | Integrate selectively | Use native metrics first and assess OSS components for proven deterministic, RAG, and calibration logic. |
| Hosted third-party eval platform | Do not adopt for V1 | It would duplicate storage, governance, and product surface and require data movement. |

The dogfood build should use competitor products as interaction references and open-source libraries as candidate components, not as external services receiving Snowflake trace data.

## 15. Security and governance

### 15.1 Access

- Require appropriate `USAGE` or `MONITOR` access to the agent and `SNOWFLAKE.CORTEX_USER` as applicable.
- Respect `READ UNREDACTED AI OBSERVABILITY EVENTS TABLE`; users without it must not receive unredacted content through the app or CoCo.
- Use caller’s rights for source telemetry so the app cannot broaden access.
- Separate permission to read traces, annotate, govern taxonomy, approve evaluators, and apply agent changes.

| Capability | Minimum application role | Enforcement |
|---|---|---|
| Read trace metadata/content | `TRACE_READER` plus native agent/observability privileges | Caller's-rights source query and current-access check |
| Create or edit own review | `REVIEWER` | Agent-scoped secure view or owner-rights procedure validating caller and row scope |
| View another review | `REVIEW_AUDITOR` | Agent-scoped secure view |
| Govern rubric or taxonomy | `QUALITY_OWNER` | Versioned owner-rights procedure with agent ownership check |
| Approve evaluator or dataset case | `EVALUATOR_APPROVER` | Typed approval procedure and separation from proposing agent |
| Apply agent change | `AGENT_CHANGE_APPROVER` plus native target privilege | Explicit confirmation, clone/version target, and optimistic version check |

Application roles are additive but do not replace native Snowflake privileges. Negative authorization tests must cover cross-agent rows, cached content, revoked source access, redacted fields, and assistant prompts. Raw annotation tables are not granted directly to application users; secure views and typed procedures enforce scope.

### 15.2 Sensitive content

- Treat prompts, tool inputs/outputs, SQL, search results, and reviewer notes as customer data.
- Do not send them to external services.
- Assistant prompts must contain only fields the current caller may view.
- Render redaction explicitly rather than inferring missing content.
- Prevent client logs and error telemetry from recording full trace payloads.

### 15.3 Audit and mutation controls

- Append-only audit events record state transitions.
- CoCo proposals and human decisions are distinct records.
- Applying a correction requires a typed payload and current-version check.
- Agent changes require explicit confirmation and target a clone or committed non-production version.
- Conflicting edits return a reviewable conflict rather than last-write-wins.

## 16. Metrics and success criteria

### 16.1 North-star

The dogfood north-star is:

> The quality owner can turn reviewed execution evidence into a stable failure taxonomy and validated course corrections with materially less context-switching and no loss of provenance.

For a mature operating system, the coverage measure becomes:

> Percentage of relevant production traces covered by validated evaluators while continuing human audits remain within criterion-specific false-negative limits.

### 16.2 Metric groups

| Group | Measures |
|---|---|
| Review usefulness | Completed focused sessions; percentage producing a usable judgment; draft abandonment; reviewer-reported comprehension. |
| Efficiency | Active review time by known vs novel issue; navigation wait; tag-to-next time; context switches outside the app. |
| Discovery | New failure modes per diverse trace; traces since last material taxonomy change; coverage of small clusters. |
| Taxonomy health | Share of failed traces covered by confirmed tags; merge/split/reclassification rate; unresolved observations. |
| Course correction | Corrections converted to ground truth; proposals approved/edited/rejected; time from finding to executable case. |
| Evaluator quality | TPR, TNR, false-negative rate, balanced accuracy, agreement, disagreement resolution, cost and latency. |
| Agent quality | Quality-bar pass rate by pinned agent and rubric version; regression count; recurrence of corrected failures. |
| System performance | Trace-open latency, adjacent navigation latency, save success, assistant response start, payload/render errors. |

Raw traces reviewed is an operational counter, not a success metric.

### 16.3 Dogfood exit criteria

- A quality owner completes one seeded discovery pass, initially targeting 30 traces, and one targeted deep dive without external notes; the trace count is a usability seed rather than evidence of saturation.
- 100% of completed reviews retain source, rubric, taxonomy, and durable evidence-snapshot lineage.
- Median adjacent-trace navigation after initial load is below 300 ms from prefetched state.
- Known-failure classification requires no more than failure-span selection, tag selection, and advance.
- At least 80% of confirmed failure definitions sampled by the owner are judged actionable and non-duplicative after synthesis; no minimum category count is imposed.
- At least one course correction is promoted into a native-compatible evaluation case.
- At least one custom or deterministic evaluator is tested against a frozen held-out human label set with documented class counts, leakage checks, and criterion-specific acceptance thresholds.
- The owner can inspect every judge disagreement from the calibration report.
- No agent or dataset mutation can occur without an explicit human approval event.
- The quality owner completes the core task without needing external notes in at least 90% of observed dogfood sessions and rates task/trajectory comprehension at least 4 of 5.

## 17. Milestones

| Milestone | Entry | Capability | Exit |
|---|---|---|---|
| M0: Safety and source spike | Dogfood agent nominated | Sample real UDTF outputs, compound keys, RBAC matrix, durable snapshot policy, threat model, schema adapter, migration/recovery plan, and cost budget | Read-only source adapter and negative access tests pass; adversarial assistant design reviewed |
| M1: Trace reader and annotation core | Native trace access confirmed | Separate source queues, task-first canvas, progressive disclosure, outcomes, dimensions, first failure, notes, tags, autosave | Complete trace review with durable provenance |
| M2: Discovery and deep dive | Review schema stable | Mixed-signal features, diverse queue, targeted queues, prefetch and keyboard workflow | Owner completes both review modes |
| M3: Synthesis and quality bar | Sufficient open observations | CoCo-assisted grouping, versioned taxonomy, rubric editor, saturation view | Confirmed taxonomy with governed definitions |
| M4: Course correction | Confirmed failures exist | Desired behavior, typed CoCo proposals, evaluation-case promotion | Approved correction becomes native-compatible case |
| M5: Evaluator lab | Trusted labels exist | Deterministic/custom judge drafts, frozen splits, calibration metrics, disagreement review | One scoped evaluator approved or explicitly rejected |
| M6: Closed native loop | Pinned agent versions available | Propose clone/version change, run native evaluation, compare recurrence | Evidence links correction to validation result |
| M7: Collaboration and monitoring | Single-owner workflow validated | Blind assignment, adjudication, production scoring queues, drift audits | Multi-reviewer and ongoing assurance model validated |

M0 through M5 define V1. M6 and M7 are post-V1. Milestones are sequential learning gates, not delivery commitments. Each milestone adds database migration, rollback, audit, usage/cost telemetry, source-schema compatibility, and recovery tests appropriate to its state changes.

Before implementing each milestone, complete a reuse checkpoint: compare the requirement with current native Snowflake capability and the reference patterns in Section 20. Adopt an existing contract or component where it preserves Snowflake governance and the Workbench's human-review premise. Record why any custom implementation is necessary.

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Reviewer anchoring by machine output | Hide judge and cluster semantics during initial discovery judgment. |
| Clustering hides rare or novel failures | Maintain random baseline, diverse sampling, and small-cluster oversampling. |
| Taxonomy competes with GPA | Require every failure mode to map beneath a GPA dimension or explicitly justify `cross-cutting`. |
| PM lacks domain authority | Distinguish accountable quality owner from qualified criterion reviewer. |
| Criteria drift during review | Version rubrics and taxonomy; never rewrite historical judgment silently. |
| Judge validates itself | Require held-out human labels; prohibit machine-generated validation labels. |
| Evaluation set mistaken for production | Separate queues, rates, filters, and language throughout the UI. |
| Native schemas evolve | Isolate source adapters and retain raw source references; avoid hard-coded UI coupling to unstable fields. |
| Long traces make the app slow | On-demand span fetch, bounded cache, summaries, virtualization, prefetch, and progressive disclosure. |
| Standalone app creates a second platform | Position as dogfood incubation, integrate with native artifacts, and avoid duplicating run execution views. |
| CoCo applies unsafe changes | Typed proposal/approval/application boundary; least privilege; clone/version targets. |
| Sensitive trace content leaks | Caller’s rights, redaction propagation, no external egress, payload-safe logs. |
| Overfitting evaluator to labeled set | Frozen held-out sets, cluster-stratified reporting, continued random audits. |
| Trace content injects instructions into CoCo | Delimited evidence, narrow read-only tool allowlist, structured output validation, adversarial tests. |
| Single-owner labels encode inconsistency | Blind repeat-label audit; second qualified review for disputed or high-consequence criteria. |
| Late or duplicate telemetry changes a trace | Compound source keys, payload hashes, snapshots, stale markers, and re-review queues. |
| Assistant or model is unavailable | Human review remains fully functional; retry/cancel does not discard drafts. |
| Assistant cost grows without bound | Per-session model, turn, token, duration, and cost budgets with visible usage. |
| Evaluator sees held-out labels indirectly | Frozen split membership, provenance checks, prompt/input audit, and leakage test before approval. |
| Preview API or schema changes | Adapter contract tests, feature flags, and stop-ship compatibility checks. |
| Product expands into a generic eval platform | Enforce build/borrow/defer boundaries and require a reuse checkpoint for every milestone. |
| Proprietary workflow traps reviewed evidence | Canonical Snowflake tables plus documented relational/JSON export contracts. |

## 19. Open decisions

1. Which concrete Snowhouse agent and trace population should be used for the first dogfood cycle?
2. Which App Runtime database, schema, role, warehouse, compute pool, and build EAI should host the application?
3. Should the first embedded assistant use a persistent Coding Agent object or an inline hosted configuration?
4. What minimum trace snapshot must remain durable when source retention expires?
5. Which universal criteria beyond the three diagnostic dimensions, if any, are required?
6. What is the first high-consequence failure mode for calibration, and what false-negative threshold is acceptable?
7. Should evaluation dataset promotion write directly after approval or first create a staged candidate table for inspection?
8. Which native UI deep links are stable enough to include?
9. What evidence should trigger re-review when an agent version materially changes?
10. How should taxonomy definitions be shared across agents without prematurely forcing a universal ontology?
11. Which evaluator components can run safely in Snowflake App Runtime or a Snowflake job without exporting trace data?
12. Is pairwise review needed in V1 for the first dogfood agent, or should its schema be implemented while UI delivery waits for M6?
13. Which typed agent changes can be replayed safely from the Workbench, and which should remain deep links to CoCo/native tooling?

## 20. Source notes

### Public methodology

- Hamel Husain and Shreya Shankar, [AI Evals: Everything You Need to Know](https://hamel.dev/blog/posts/evals-faq/). Source for error analysis, open and axial coding, first-failure review, theoretical saturation, sampling, human-label validation, and progressive disclosure.
- Hamel Husain, [Evals Skills for Coding Agents](https://hamelhusain.substack.com/p/evals-skills-for-coding-agents). Source for the error-analysis, review-interface, judge-writing, and evaluator-validation workflow.
- Hamel Husain, [Selecting The Right AI Evals Tool](https://hamel.dev/blog/posts/eval-tools/). Source for human-in-the-loop workflow and actionable failure-table considerations.

### Tool-pattern references

These products are design references, not V1 runtime dependencies or destinations for Snowflake data:

| Tool | Patterns to learn from | Patterns to avoid or defer |
|---|---|---|
| LangSmith | Trace-to-playground continuity; single-run and pairwise annotation queues; assertions as expected behavior; dataset promotion; evaluator/human alignment view | Crowded all-in-one surface; framework-shaped concepts that do not map cleanly to Cortex Agents |
| Braintrust | Clean readable trace review; keyboard and kanban queues; editable expected values; provenance-preserving trace-to-dataset flow; failure table; inline baseline/candidate diff | Proprietary BTQL; AI creating and immediately applying its own rubric; rebuilding its complete platform |
| Arize Phoenix | Open, hackable trace/dataset/experiment APIs; span replay; dataset-attached evaluators; repetitions; traceable evaluator executions; agent embedded in the product | Generic tracing backend duplication; prompt-centric UI where the correction spans tools and semantic context |
| Evidently | Open-source descriptors and test suites; classification reports; train/validation/test prompt optimization from expert labels; data/score drift patterns; ordinary DataFrame/JSON interfaces | A second storage and monitoring service; treating a metric catalog as a substitute for error discovery |

Current capabilities change quickly. Reassess these references at implementation time; preserve the evaluation principles even when individual product comparisons become stale.

### Public Snowflake product capability

- [Cortex Agent evaluations](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-evaluations). Native datasets, GPA and custom metrics, trace details, metric versioning, run comparison, and SQL access.
- [Monitor Cortex Agent requests](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-monitor). Production threads, traces, feedback, access, and observability functions.
- [Coding Agent](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-coding-agent). Hosted CoCo toolset through Cortex Agents REST API and approval behavior.
- [Cortex Code Agent SDK](https://docs.snowflake.com/en/user-guide/cortex-code-agent-sdk/cortex-code-agent-sdk). Local SDK capability and the reason it is not the deployed embedded-agent path.
- [Snowflake App Runtime](https://docs.snowflake.com/en/developer-guide/snowflake-app-runtime/about-snowflake-app-runtime). Intended application host.

### Internal directional evidence

Internal roadmap material reviewed on 2026-09-17 includes annotation support with CoCo, dataset versioning, production trace scoring, alerting, query clustering, rich annotated feedback capture, and Agent Autopilot. Those directions validate the problem but are not delivery commitments. This PRD deliberately treats the custom app as a dogfood incubation surface and native Agent Evaluations, AI Observability, Agent Studio, and CoCo as the likely long-term destination.

Relevant internal sources:

- [Snowflake CoWork & Agents Steering](https://docs.google.com/document/d/1W_wPee0XjiGE4vZjkt-91tR5v1ApCY9Fkz3t-w1cvEM)
- [Cortex Agent Evaluations](https://docs.google.com/presentation/d/1KHPjmfbniVPsV9sBtuP35-QPu4nNiGL8466Hqh9WBuw)
- [FY27 SKO - AFE x Product - AI Observability and Evaluation](https://docs.google.com/presentation/d/1Y-nKXZdm4SgNKw3YhFhq7xk5-55PYZ4cH2vxKa2YHt4)
- [AI Vision + Roadmap Walking Deck](https://docs.google.com/presentation/d/1_GwBecTlOdzEhRMEALgBFaIlzJp1Bumdyb0S-BW_ocg)

## 21. Acceptance criteria for implementation planning

The PRD is ready to move into technical design when:

- The first dogfood agent and source populations are named.
- The V1 quality bar and first review rubric are drafted.
- App Runtime hosting coordinates and caller’s-rights model are agreed.
- Source UDTF output has been sampled with the intended role.
- The annotation and lineage schema has been reviewed against real trace identifiers.
- The embedded CoCo permission boundary has been threat-modeled.
- M1 wireframes have been tested with at least one agent owner using representative long and short traces.
