/** App title — displayed in the nav header and browser tab */
export const APP_TITLE = "Agent Trace Review Workbench"

/** Path to the logo in /public (used in the header and as favicon) */
export const LOGO_SRC = "/icon.svg"

export const DOGFOOD_AGENT = {
  database: process.env.TRACE_AGENT_DATABASE ?? "DEMO_AGENTIC",
  schema: process.env.TRACE_AGENT_SCHEMA ?? "SUPPORT",
  name: process.env.TRACE_AGENT_NAME ?? "SUPPORT_AGENT",
} as const

export const REVIEW_STORE = {
  database: process.env.REVIEW_DATABASE ?? "RULE190",
  schema: process.env.REVIEW_SCHEMA ?? "APP",
} as const
