# Conventions

What the next repo should inherit from this one. Everything here was learned
building `rule190`; nothing is aspirational.

## 1. `verify` is the contract

```json
"typecheck": "tsc --noEmit",
"verify": "npm run typecheck && npm run test && npm run build"
```

One command is the definition of "good". CI runs exactly it — no extra steps,
no different flags. If CI is green and `npm run verify` fails on your laptop,
that is a bug in the repo, not in your machine.

Order matters: cheapest and most specific failure first, so you get a type
error rather than a build log.

**Run all three even though they overlap.** The TypeScript 7 Dependabot PR
passed `typecheck` and failed `build`. Either step alone would have said
"fine".

## 2. Never bypass the type checker

`next.config.mjs` had `typescript: { ignoreBuildErrors: true }`. That makes
`next build` succeed while types are broken, so a broken build can deploy.

Remove that kind of flag while the tree is clean — it costs nothing then, and
it is nearly impossible later. This is a *ratchet*: it doesn't fix existing
problems, it prevents new ones.

## 3. Pure logic belongs in `lib/`, not in route handlers

`normalizeProduction` and `validateReview` lived inside route files. A route
module should only export HTTP handlers, so there was nothing importable and
therefore nothing tested — the two functions the product depends on most.

Moving them to `lib/` made them testable against the *real* code path rather
than a copy.

## 4. Tests must be shown to bite

A test that passes when the code is broken is worse than no test: it buys
false confidence. After writing one, break the thing it covers and confirm it
fails.

Done here by removing the `skip rows with no trace id` guard and the
`failureSpanId` requirement, confirming a failure each time, then reverting.
Two minutes, and it is the difference between a test and a decoration.

Test the behaviour that would silently degrade, not the line count. The trace
grouping test exists because 938 events collapsing to 93 traces is the whole
product; if it regresses, every request still returns `200` and the app is
quietly useless.

## 5. Commit the known-bad baseline first

The first commit here imports the code unchanged, with its defects listed in
the message. Every fix after it is a legible diff against a known state.
Squashing "import and fix" into one commit hides what was wrong, which is the
only part worth reading later.

## 6. PR CI gets no credentials

Split the pipelines:

- **`ci.yml`** — PR and push. Correctness only. No Snowflake, no secrets.
- **`deploy.yml`** — `workflow_dispatch` only. Has Snowflake access.

Pull requests can come from anywhere. A PR-triggered job that can reach your
account is a job an outsider can make reach your account.

Other invariants worth copying:

- `permissions:` declared explicitly. Declaring the block drops every unlisted
  scope to `none`. `ci.yml` gets `contents: read` and nothing else.
- `npm ci`, never `npm install`. `ci` installs exactly what the lockfile pins
  and fails if the lockfile and `package.json` disagree.
- `concurrency` cancels superseded *branch* runs, never `main`, and never
  cancels a deploy — a half-applied deploy is worse than a late one.
- Node version from `.nvmrc`, read by both CI and your shell.

## 7. Secrets: don't have any

Deployment authenticates with GitHub OIDC. There is no password, PAT, private
key, or `config.toml` in the repo, in GitHub secrets, or on the Snowflake
user. Nothing can leak because nothing exists.

The account identifier is **not** a secret — hardcode it. Pretending
otherwise adds ceremony and buys nothing.

`.gitignore` covers `.env*`, `*.p8`, `*.pem`, `*.key`, `connections.toml`,
`config.toml`. Deliberately wider than the files in use, because git history
is not practically redactable once pushed.

## 8. Deployment identity is narrow and bound

- A dedicated role (`R190_DEPLOY`) scoped to one schema. **Not `ACCOUNTADMIN`.**
- A `TYPE = SERVICE` user with no credential, only a `WORKLOAD_IDENTITY`.
- The OIDC subject pins repo *and* environment, so the trust cannot be reused
  from a fork or another branch.
- Network access opened at the **user** level, not by widening the account
  policy. Fixing CI should not change what your colleagues can reach.

## 9. Privileged bootstrap and repeatable deploy are different jobs

One-time, needs an admin: databases, schemas, roles, service users, network
policy. Lives in `docs/deployment.md`.

Every deploy, needs almost nothing: `sql/setup.sql`, table-only, `IF NOT
EXISTS`. If CI could create databases, CI would need `CREATE DATABASE` on the
account, and a compromised workflow could create objects anywhere.

Make every deploy-time statement idempotent. A deploy step you are afraid to
run twice is a deploy step you will eventually run twice by accident.

## 10. Assert things that are true when healthy

Our first health check asserted `HTTP 200` from an endpoint behind SSO, which
answers `302` when healthy. It failed a deploy that had worked.

Before asserting a value, check what a healthy system actually returns.

## 11. One canonical copy of a document

The PRD existed in both `latinum` and `rule190`. Two copies drift: you edit
one, ship from the other, and nothing tells you they disagree. The spec now
lives with the code it describes; the other location holds a pointer.

## 12. One repo, one purpose

`rule190` was extracted from `latinum` because they are different things: an
analysis workspace and a deployable app. A repo that is both cannot have a
meaningful `verify`, because there is no single definition of working.
