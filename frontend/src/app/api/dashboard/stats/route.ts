import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryOne } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const stats = await queryOne<{
      total_tokens: number; total_cost: number; total_requests: number
    }>(
      `SELECT
         COALESCE(SUM(total_tokens), 0)::int as total_tokens,
         COALESCE(SUM(cost_cents), 0)::int as total_cost,
         COUNT(*)::int as total_requests
       FROM billing_records
       WHERE user_id = $1
         AND status = 'success'`,
      [session.sub]
    )

    return NextResponse.json(stats || { total_tokens: 0, total_cost: 0, total_requests: 0 })
  } catch (err) {
    console.error("stats error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
