# Deployment

How `rule190` gets from a laptop into Snowflake, and how to reproduce the
setup from scratch.

## The shape of it

```
laptop ──git push──> GitHub ──CI (no Snowflake access)──> merge
                        │
                        └── workflow_dispatch ──> dogfood environment
                                                      │
                                                 OIDC token
                                                      │
                                    Snowflake: SVC_GITHUB_ACTIONS_RULE190
                                                      │
                                               role R190_DEPLOY
                                                      │
                                    RULE190.APP.AGENT_TRACE_REVIEW_WORKBENCH
```

Two pipelines, two different privilege levels, on purpose:

| | `ci.yml` | `deploy.yml` |
|---|---|---|
| Trigger | PR, push to `main` | manual only |
| Snowflake access | **none** | OIDC, role `R190_DEPLOY` |
| Secrets | none | none — OIDC has no stored credential |
| Runs | typecheck, tests, build | verify, then deploy |

`ci.yml` cannot touch Snowflake by design. Pull requests can come from
anywhere; a PR-triggered job that can reach the account is a job an outsider
can make reach the account.

## Identity: no credential exists to steal

`SVC_GITHUB_ACTIONS_RULE190` is `TYPE = SERVICE` with **no password, no
key-pair, no PAT**. Its only way in is a GitHub-issued OIDC token whose
subject matches exactly:

```
repo:sfc-gh-mitaylor@125584759/rule190@1377246034:environment:dogfood
```

Three things are bound into that string: the repo owner, the repo, and the
deployment environment — the last two by immutable numeric ID. A fork, a
different branch, another repo, or the same workflow outside the `dogfood`
environment produces a different subject and is rejected.

**The numeric IDs are not optional and not guessable.** This GitHub
enterprise applies OIDC subject customisation. The documented default
(`repo:owner/repo:environment:name`) was rejected. The way to find the real
value is to deploy once, let it fail, and read the subject out of the
Snowflake error — it logs exactly what it received. Do not guess it.

## Network policy

The account has `NETWORK_POLICY = ACCOUNT_VPN_POLICY_SE`, an IP allowlist of
VPN egress ranges. GitHub-hosted runners are not in it, so login fails.

The fix is a **user-level** policy on the service user only:

```sql
CREATE NETWORK POLICY R190_GITHUB_ACTIONS_POLICY
  ALLOWED_NETWORK_RULE_LIST = ('SNOWFLAKE.NETWORK_SECURITY.GITHUBACTIONS_GLOBAL');
ALTER USER SVC_GITHUB_ACTIONS_RULE190 SET NETWORK_POLICY = R190_GITHUB_ACTIONS_POLICY;
```

User-level overrides account-level *for that user*, so CI gets through and
nobody else's restrictions change. The account policy was not modified.

`SNOWFLAKE.NETWORK_SECURITY.GITHUBACTIONS_GLOBAL` is maintained by Snowflake
and tracks GitHub's runner IPs. Never hand-maintain a CIDR list for hosted
runners — the ranges rotate and CI breaks silently when they do.

## Bootstrap: run once, by an administrator

This is the privileged half. It is deliberately **not** in `sql/setup.sql`,
because if CI could run it, CI would need `CREATE DATABASE` on the account.

```sql
CREATE DATABASE IF NOT EXISTS RULE190;
CREATE SCHEMA   IF NOT EXISTS RULE190.APP;

CREATE ROLE IF NOT EXISTS R190_DEPLOY;
GRANT USAGE ON DATABASE RULE190 TO ROLE R190_DEPLOY;
GRANT USAGE ON SCHEMA RULE190.APP TO ROLE R190_DEPLOY;
GRANT CREATE TABLE               ON SCHEMA RULE190.APP TO ROLE R190_DEPLOY;
GRANT CREATE STAGE               ON SCHEMA RULE190.APP TO ROLE R190_DEPLOY;
GRANT CREATE SERVICE             ON SCHEMA RULE190.APP TO ROLE R190_DEPLOY;
GRANT CREATE APPLICATION SERVICE ON SCHEMA RULE190.APP TO ROLE R190_DEPLOY;
GRANT CREATE ARTIFACT REPOSITORY ON SCHEMA RULE190.APP TO ROLE R190_DEPLOY;
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE R190_DEPLOY;

CREATE USER IF NOT EXISTS SVC_GITHUB_ACTIONS_RULE190
  TYPE = SERVICE
  DEFAULT_ROLE = R190_DEPLOY
  DEFAULT_WAREHOUSE = COMPUTE_WH
  WORKLOAD_IDENTITY = (
    TYPE = OIDC
    ISSUER = 'https://token.actions.githubusercontent.com'
    SUBJECT = 'repo:sfc-gh-mitaylor@125584759/rule190@1377246034:environment:dogfood'
  );
GRANT ROLE R190_DEPLOY TO USER SVC_GITHUB_ACTIONS_RULE190;
```

Then the network policy above, and a GitHub environment named `dogfood`.

`sql/setup.sql` is the unprivileged half: it creates only the review table,
`IF NOT EXISTS`, and runs on every deploy.

## Why `build_job_location` is set in `app.yml`

The App Runtime remote build job defaults to the deploying role's *personal*
database, `USER$<login_name>`. A `TYPE = SERVICE` user has no personal
database, so the build phase fails. `build_job_location: RULE190.APP` points
it at the deploy destination instead, which is why the deploy role needs
`CREATE SERVICE` on that schema.

## Health checks: assert something true

The first deploy succeeded and the health check failed it. The check asserted
`HTTP 200` from `/api/health`. The app endpoint sits behind Snowflake SSO, so
an unauthenticated request from a runner gets `302` to login — correctly.
Asserting `200` was asserting that authentication is broken.

What the check asserts now:

1. `SHOW APPLICATION SERVICES` reports `RUNNING`, ≥1 instance, non-empty URL.
2. The endpoint is serving rather than erroring — `2xx`, `3xx`, `401`, `403`
   pass; `5xx` or no response fails.

## Operating it

```bash
snow app open                      # open the deployed app
snow app events                    # recent logs
snow app deploy                    # redeploy (prefer the workflow)
snow app teardown                  # drop the service and its objects
```

Deployed app: <https://f7cejrh-sfseeurope-eu-demo211.snowflakecomputing.app>
