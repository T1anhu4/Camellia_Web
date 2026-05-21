import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { pool } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM channels WHERE status = 'active') as active_channels,
        COALESCE((SELECT SUM(cost_cents) FROM billing_records WHERE created_at >= CURRENT_DATE AND status = 'success'), 0) as today_revenue_cents,
        COALESCE((SELECT SUM(total_tokens) FROM billing_records WHERE created_at >= CURRENT_DATE AND status = 'success'), 0) as today_tokens,
        COALESCE((SELECT COUNT(*) FROM billing_records WHERE created_at >= CURRENT_DATE AND status = 'success'), 0) as total_requests_today
    `)

    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("admin stats error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
