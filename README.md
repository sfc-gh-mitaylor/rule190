# Agent Trace Review Workbench

Dogfood Snowflake App for task-first human review of Cortex Agent traces. It reads native evaluation and production observability data with caller's rights, captures the overall quality outcome and first consequential failure, and stores reviewer evidence in Snowflake.

## Current Scope

- Agent: `DEMO_AGENTIC.SUPPORT.SUPPORT_AGENT` by default; override with `TRACE_AGENT_DATABASE`, `TRACE_AGENT_SCHEMA`, and `TRACE_AGENT_NAME`.
- Sources: production events and a named evaluation run, kept in separate queues.
- Judgments: `Met bar`, `Did not meet bar`, or `Unclear`, plus universal quality dimensions.
- Evidence: failure-span anchor, approved failure tag or open observation, and desired behavior.
- Persistence: `RULE190.APP.AGENT_TRACE_HUMAN_REVIEW` by default; override with uppercase `REVIEW_DATABASE` and `REVIEW_SCHEMA` identifiers.

Defaults live in [lib/constants.ts](lib/constants.ts) — that file is the source of truth, not this list.

## Prerequisites

- Snowflake CLI `3.17+`. Use `/opt/homebrew/bin/snow` on this machine because Anaconda also installs an older `snow` executable.
- `MONITOR` or `OWNERSHIP` on the selected Cortex Agent and `SNOWFLAKE.CORTEX_USER`.
- `READ UNREDACTED AI OBSERVABILITY EVENTS TABLE` when full authorized trace content is required.
- Run `sql/setup.sql` with an appropriate application owner role before reviewer traffic. Review persistence uses the app service identity; native trace reads use caller's rights.

## Local Development

```bash
SNOWFLAKE_CONNECTION_NAME=eudemo npm run dev
```

The health endpoint is `/api/health`. Local caller's-rights queries use the configured local connection; deployed requests use the Snowflake-injected caller token because `app.yml` sets `executeAsCaller: true`.

## Verification

```bash
npm run verify
/opt/homebrew/bin/snow app validate --connection eudemo
```

`npm run verify` chains the Node check, typecheck, tests, and production build —
the same four steps CI runs, so local green predicts remote green.

## Deployment

`app.yml` resolves to `RULE190.APP`, warehouse `COMPUTE_WH`, with
`executeAsCaller: true`. Deploy with:

```bash
/opt/homebrew/bin/snow app deploy --connection eudemo
```

Deployed app: <https://f7cejrh-sfseeurope-eu-demo211.snowflakecomputing.app>

See [docs/deployment.md](docs/deployment.md) for reviewer access and the
operating commands.

## Shipping changes

`main` is gated by the `main-requires-verify` ruleset. Changes arrive via PR and
need two status checks: `verify` (CI — real evidence the code builds and passes)
and `review-attested` (a signature that a human read the diff). The second is a
process control, not a security boundary: the maintainer signs it themselves.
See [docs/conventions.md](docs/conventions.md) section 14 for what it does and
does not buy.

Use the `ship` skill in Cortex Code rather than driving git and `gh` by hand. It
runs verify, dispatches a cross-vendor adversarial review of the diff, opens the
PR, and waits for your attestation before arming auto-merge.