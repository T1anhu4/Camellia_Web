import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { execute, queryOne } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { channel_id, new_balance_usd } = await req.json()
    if (!channel_id || new_balance_usd === undefined) {
      return NextResponse.json({ error: "channel_id and new_balance_usd required" }, { status: 400 })
    }

    const usd = parseFloat(new_balance_usd)
    if (isNaN(usd) || usd < 0) {
      return NextResponse.json({ error: "Invalid balance" }, { status: 400 })
    }

    // Convert USD → RMB cents at 7.2 exchange rate
    const newBalanceCents = Math.round(usd * 7.2 * 100)

    // Only update balance_cents — never touch initial_balance_cents
    await execute(
      `UPDATE channels SET balance_cents = $1, balance_updated_at = NOW() WHERE id = $2`,
      [newBalanceCents, channel_id]
    )

    const updated = await queryOne<{ id: string; balance_cents: number; initial_balance_cents: number }>(
      "SELECT id, balance_cents, initial_balance_cents FROM channels WHERE id = $1",
      [channel_id]
    )

    return NextResponse.json({
      success: true,
      channel: updated,
      new_balance_cents: newBalanceCents,
    })
  } catch (err) {
    console.error("calibrate-balance error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
