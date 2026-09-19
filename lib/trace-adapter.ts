import { DOGFOOD_AGENT, REVIEW_STORE } from "@/lib/constants"

export function quotedIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(value)) {
    throw new Error(`Invalid Snowflake identifier: ${value}`)
  }
  return `"${value.replaceAll('"', '""')}"`
}

export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

export function reviewTable(): string {
  return [REVIEW_STORE.database, REVIEW_STORE.schema, "AGENT_TRACE_HUMAN_REVIEW"]
    .map(quotedIdentifier)
    .join(".")
}

export function productionTraceSql(): string {
  return `
    SELECT RECORD, RECORD_ATTRIBUTES, VALUE, TRACE, TIMESTAMP, RESOURCE_ATTRIBUTES
    FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS(
      ${sqlLiteral(DOGFOOD_AGENT.database)}, ${sqlLiteral(DOGFOOD_AGENT.schema)}, ${sqlLiteral(DOGFOOD_AGENT.name)}, 'CORTEX AGENT'
    ))
    ORDER BY TIMESTAMP DESC
    LIMIT 2000
  `
}

export function evaluationTraceSql(): string {
  return `
    SELECT *
    FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_EVALUATION_DATA(
      ${sqlLiteral(DOGFOOD_AGENT.database)}, ${sqlLiteral(DOGFOOD_AGENT.schema)}, ${sqlLiteral(DOGFOOD_AGENT.name)}, 'CORTEX AGENT', ?
    ))
  `
}

export function recordTraceSql(): string {
  return `
    SELECT *
    FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_RECORD_TRACE(
      ${sqlLiteral(DOGFOOD_AGENT.database)}, ${sqlLiteral(DOGFOOD_AGENT.schema)}, ${sqlLiteral(DOGFOOD_AGENT.name)}, 'CORTEX AGENT', ?
    ))
    ORDER BY START_TIMESTAMP
  `
}

export function productionRecordTraceSql(): string {
  return `
    SELECT RECORD, RECORD_ATTRIBUTES, VALUE, TRACE, TIMESTAMP, RESOURCE_ATTRIBUTES
    FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS(
      ${sqlLiteral(DOGFOOD_AGENT.database)}, ${sqlLiteral(DOGFOOD_AGENT.schema)}, ${sqlLiteral(DOGFOOD_AGENT.name)}, 'CORTEX AGENT'
    ))
    WHERE COALESCE(TRACE:trace_id::VARCHAR, RECORD_ATTRIBUTES:"snow.trace_id"::VARCHAR) = ?
    ORDER BY TIMESTAMP
  `
}

export const createReviewTableSql = `
  CREATE TABLE IF NOT EXISTS ${reviewTable()} (
    REVIEW_ID VARCHAR DEFAULT UUID_STRING(),
    REVIEWER VARCHAR NOT NULL,
    SOURCE VARCHAR NOT NULL,
    AGENT_FQN VARCHAR NOT NULL,
    TRACE_ID VARCHAR NOT NULL,
    RECORD_ID VARCHAR,
    INPUT_SNAPSHOT VARCHAR,
    OUTPUT_SNAPSHOT VARCHAR,
    OUTCOME VARCHAR NOT NULL,
    DECISION_QUALITY VARCHAR,
    EXECUTION_QUALITY VARCHAR,
    RESPONSE_QUALITY VARCHAR,
    FAILURE_SPAN_ID VARCHAR,
    UNCERTAINTY_REASON VARCHAR,
    FAILURE_TAG VARCHAR,
    OBSERVATION VARCHAR,
    DESIRED_BEHAVIOR VARCHAR,
    REVIEW_STATUS VARCHAR NOT NULL,
    RUBRIC_VERSION INTEGER DEFAULT 1,
    CREATED_AT TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (REVIEWER, SOURCE, AGENT_FQN, TRACE_ID)
  )
`

export const agentFqn = `${DOGFOOD_AGENT.database}.${DOGFOOD_AGENT.schema}.${DOGFOOD_AGENT.name}`

export function toIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return { value }
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : { value }
}

export function compactText(value: unknown, max = 8000): string | null {
  if (value === null || value === undefined) return null
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  return text.length > max ? `${text.slice(0, max)}\n[truncated]` : text
}

export function pickText(value: unknown, keys: string[]): string {
  const pending: unknown[] = [value]
  while (pending.length) {
    const item = pending.shift()
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    for (const key of keys) {
      const found = record[key]
      if (typeof found === "string" && found.trim()) return found
    }
    pending.push(...Object.values(record).filter((child) => child && typeof child === "object"))
  }
  return ""
}