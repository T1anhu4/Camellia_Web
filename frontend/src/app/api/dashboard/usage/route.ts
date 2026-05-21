import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryMany } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
    const end = searchParams.get("end") || new Date().toISOString().split("T")[0]

    // Daily aggregated usage
    const rows = await queryMany<{ date: string; tokens: number; cost: number; requests: number }>(
      `SELECT
         DATE(created_at) as date,
         COALESCE(SUM(total_tokens), 0)::int as tokens,
         COALESCE(SUM(cost_cents), 0)::int as cost,
         COUNT(*)::int as requests
       FROM billing_records
       WHERE user_id = $1
         AND created_at >= $2::date
         AND created_at < ($3::date + interval '1 day')
         AND status = 'success'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [session.sub, start, end]
    )

    // Current month totals
    const totals = await queryMany<{ total_tokens: number; total_cost: number; total_requests: number }>(
      `SELECT
         COALESCE(SUM(total_tokens), 0)::int as total_tokens,
         COALESCE(SUM(cost_cents), 0)::int as total_cost,
         COUNT(*)::int as total_requests
       FROM billing_records
       WHERE user_id = $1
         AND created_at >= date_trunc('month', now())
         AND status = 'success'`,
      [session.sub]
    )

    return NextResponse.json({
      data: rows,
      totals: totals[0] || { total_tokens: 0, total_cost: 0, total_requests: 0 },
    })
  } catch (err) {
    console.error("usage error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
