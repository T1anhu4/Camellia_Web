import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryMany } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const records = await queryMany<{
      id: number; model_name: string; total_tokens: number
      cost_cents: number; balance_after: number
      status: string; created_at: string
    }>(
      `SELECT id, model_name, total_tokens, cost_cents,
              balance_after, status, created_at
       FROM billing_records
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [session.sub]
    )

    return NextResponse.json(records)
  } catch (err) {
    console.error("billing records error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
