import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryMany } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rows = await queryMany<{
      model_name: string; total_requests: number; total_tokens: number; total_cost: number
    }>(
      `SELECT model_name,
              COUNT(*)::int as total_requests,
              COALESCE(SUM(total_tokens), 0)::int as total_tokens,
              COALESCE(SUM(cost_cents), 0)::int as total_cost
       FROM billing_records
       WHERE user_id = $1 AND status = 'success'
       GROUP BY model_name
       ORDER BY total_tokens DESC`,
      [session.sub]
    )

    return NextResponse.json(rows)
  } catch (err) {
    console.error("model-usage error:", err)
    return NextResponse.json([])
  }
}
