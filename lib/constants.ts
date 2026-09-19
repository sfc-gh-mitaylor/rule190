/** App title — displayed in the nav header and browser tab */
export const APP_TITLE = "Agent Trace Review Workbench"

/** Path to the logo in /public (used in the header and as favicon) */
export const LOGO_SRC = "/icon.svg"

export const DOGFOOD_AGENT = {
  database: process.env.TRACE_AGENT_DATABASE ?? "SNOWHOUSE",
  schema: process.env.TRACE_AGENT_SCHEMA ?? "PS_TAM",
  name: process.env.TRACE_AGENT_NAME ?? "CUSTOMER_INSIGHTS",
} as const

export const REVIEW_STORE = {
  database: process.env.REVIEW_DATABASE ?? "APPS",
  schema: process.env.REVIEW_SCHEMA ?? "PUBLIC",
} as const
