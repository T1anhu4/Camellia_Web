import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryOne, execute } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await queryOne<{
      id: string; email: string; nickname: string | null; avatar_url: string | null
      role: string; status: string; balance_cents: number
      subscription_tier: string; subscription_expires_at: string | null
      daily_token_quota: number; daily_token_used: number; created_at: string
    }>(
      `SELECT id, email, nickname, avatar_url,
              role::text, status::text,
              balance_cents, subscription_tier::text,
              subscription_expires_at, daily_token_quota, daily_token_used,
              created_at
       FROM users WHERE id = $1`,
      [session.sub]
    )

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (err) {
    console.error("me error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update current user profile
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { nickname } = await req.json()
    if (!nickname) {
      return NextResponse.json({ error: "nickname required" }, { status: 400 })
    }

    const user = await queryOne<{
      id: string; email: string; nickname: string | null; avatar_url: string | null
      role: string; status: string; balance_cents: number
      subscription_tier: string; created_at: string
    }>(
      `UPDATE users SET nickname = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, nickname, avatar_url, role::text, status::text,
                 balance_cents, subscription_tier::text, created_at`,
      [nickname.trim(), session.sub]
    )

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (err) {
    console.error("me patch error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
