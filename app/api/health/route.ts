import { DOGFOOD_AGENT } from "@/lib/constants"

export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({
    ok: true,
    agent: `${DOGFOOD_AGENT.database}.${DOGFOOD_AGENT.schema}.${DOGFOOD_AGENT.name}`,
    timestamp: new Date().toISOString(),
  })
}