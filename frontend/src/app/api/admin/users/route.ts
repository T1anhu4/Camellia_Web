import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryMany, queryOne, execute } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, +(searchParams.get("page") || 1))
    const pageSize = Math.min(100, Math.max(1, +(searchParams.get("page_size") || 20)))
    const search = searchParams.get("search") || ""
    const offset = (page - 1) * pageSize

    const where = search
      ? `WHERE email ILIKE $1 OR nickname ILIKE $1 OR username ILIKE $1`
      : ""
    const params = search ? [`%${search}%`] : []

    const users = await queryMany<any>(
      `SELECT id, email, username, nickname, role::text, status::text,
              balance_cents, subscription_tier::text,
              daily_token_used, daily_token_quota, remark, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    )

    const total = await queryMany<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM users ${where}`, params
    )

    return NextResponse.json({
      data: users,
      total: total[0]?.count || 0,
      page,
      page_size: pageSize,
    })
  } catch (err) {
    console.error("admin users error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update user fields (admin)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { user_id, status, role, subscription_tier, balance_cents, daily_token_quota, nickname, username, remark } = body

    if (!user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 })
    }

    // Build dynamic SET clause
    const sets: string[] = ["updated_at = NOW()"]
    const params: any[] = [user_id]
    let idx = 2

    if (status) { sets.push(`status = $${idx++}::user_status`); params.push(status) }
    if (role) { sets.push(`role = $${idx++}::user_role`); params.push(role) }
    if (subscription_tier) { sets.push(`subscription_tier = $${idx++}::subscription_tier`); params.push(subscription_tier) }
    if (balance_cents !== undefined) { sets.push(`balance_cents = $${idx++}`); params.push(Number(balance_cents)) }
    if (daily_token_quota !== undefined) { sets.push(`daily_token_quota = $${idx++}`); params.push(Number(daily_token_quota)) }
    if (nickname !== undefined) { sets.push(`nickname = $${idx++}`); params.push(nickname) }
    if (username !== undefined) { sets.push(`username = $${idx++}`); params.push(username) }
    if (remark !== undefined) { sets.push(`remark = $${idx++}`); params.push(remark) }

    if (sets.length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    await execute(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $1`,
      params
    )

    // Return updated user
    const updated = await queryOne<any>(
      `SELECT id, email, username, nickname, role::text, status::text,
              balance_cents, subscription_tier::text,
              daily_token_used, daily_token_quota, remark, created_at
       FROM users WHERE id = $1`,
      [user_id]
    )

    return NextResponse.json({ success: true, user: updated })
  } catch (err) {
    console.error("admin user patch error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
