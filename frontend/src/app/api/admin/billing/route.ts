import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryMany } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, +(searchParams.get("page") || 1))
    const pageSize = Math.min(100, Math.max(1, +(searchParams.get("page_size") || 20)))
    const userId = searchParams.get("user_id") || ""
    const groupBy = searchParams.get("group_by") || ""
    const startDate = searchParams.get("start") || ""
    const endDate = searchParams.get("end") || ""
    const offset = (page - 1) * pageSize

    let where = "WHERE 1=1"
    const params: unknown[] = []

    if (userId) {
      params.push(userId)
      where += ` AND br.user_id = $${params.length}`
    }
    if (startDate) {
      params.push(startDate)
      where += ` AND br.created_at >= $${params.length}::date`
    }
    if (endDate) {
      params.push(endDate)
      where += ` AND br.created_at < ($${params.length}::date + interval '1 day')`
    }

    // User-grouped mode
    if (groupBy === "user") {
      const records = await queryMany<any>(
        `SELECT u.id as user_id, u.email as user_email, u.username,
                COUNT(*)::int as total_requests,
                COALESCE(SUM(br.total_tokens), 0)::int as total_tokens,
                COALESCE(SUM(br.cost_cents), 0)::int as total_cost,
                MAX(br.created_at) as last_request_at
         FROM billing_records br
         JOIN users u ON u.id = br.user_id
         ${where}
         GROUP BY u.id, u.email, u.username
         ORDER BY total_tokens DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      )

      const total = await queryMany<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM (SELECT 1 FROM billing_records br JOIN users u ON u.id = br.user_id ${where} GROUP BY u.id) sub`,
        params
      )

      return NextResponse.json({
        data: records,
        total: total[0]?.count || 0,
        page,
        page_size: pageSize,
        grouped: true,
      })
    }

    // Default: flat records
    const records = await queryMany<any>(
      `SELECT br.id, br.user_id, u.email as user_email, u.username,
              br.model_name, br.request_id,
              br.prompt_tokens, br.completion_tokens, br.total_tokens,
              br.cost_cents, br.balance_after, br.status, br.created_at
       FROM billing_records br
       LEFT JOIN users u ON u.id = br.user_id
       ${where}
       ORDER BY br.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    )

    const total = await queryMany<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM billing_records br ${where}`, params
    )

    return NextResponse.json({
      data: records,
      total: total[0]?.count || 0,
      page,
      page_size: pageSize,
    })
  } catch (err) {
    console.error("admin billing error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
