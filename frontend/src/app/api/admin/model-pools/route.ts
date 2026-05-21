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
    const poolId = searchParams.get("id")

    // Single pool detail with keys
    if (poolId) {
      const pool = await queryOne<any>(
        `SELECT * FROM model_pools WHERE id = $1`, [poolId]
      )
      const keys = await queryMany<any>(
        `SELECT c.*, mp.name as pool_name FROM channels c
         LEFT JOIN model_pools mp ON mp.id = c.model_pool_id
         WHERE c.model_pool_id = $1
         ORDER BY c.key_priority ASC, c.created_at DESC`,
        [poolId]
      )
      return NextResponse.json({ pool, keys })
    }

    // List pools with key counts
    const pools = await queryMany<any>(
      `SELECT mp.*,
              COUNT(c.id) FILTER (WHERE c.status = 'active') as active_keys,
              COUNT(c.id) as total_keys
       FROM model_pools mp
       LEFT JOIN channels c ON c.model_pool_id = mp.id
       GROUP BY mp.id
       ORDER BY mp.created_at DESC`
    )
    return NextResponse.json(pools)
  } catch (err) {
    console.error("model-pools error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { name, display_name, description, input_price_cents, output_price_cents, cached_price_cents, pricing_mode, per_call_price_cents } = body
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })

    const pool = await queryOne<{ id: string }>(
      `INSERT INTO model_pools (name, display_name, description, input_price_cents, output_price_cents, cached_price_cents, pricing_mode, per_call_price_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name.trim(), display_name || name, description || "", input_price_cents || 0, output_price_cents || 0, cached_price_cents || 0, pricing_mode || "per_token", per_call_price_cents || 0]
    )
    return NextResponse.json({ id: pool?.id })
  } catch (err) {
    console.error("model-pool create error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    const { id, input_price_cents, output_price_cents, per_call_price_cents, pricing_mode, display_name, is_active } = body
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const sets: string[] = []; const params: any[] = [id]; let idx = 2
    if (pricing_mode) { sets.push(`pricing_mode = $${idx++}`); params.push(pricing_mode) }
    if (input_price_cents !== undefined) { sets.push(`input_price_cents = $${idx++}`); params.push(input_price_cents) }
    if (output_price_cents !== undefined) { sets.push(`output_price_cents = $${idx++}`); params.push(output_price_cents) }
    if (per_call_price_cents !== undefined) { sets.push(`per_call_price_cents = $${idx++}`); params.push(per_call_price_cents) }
    if (display_name !== undefined) { sets.push(`display_name = $${idx++}`); params.push(display_name) }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(is_active) }
    if (sets.length === 0) return NextResponse.json({ error: "no fields" }, { status: 400 })
    sets.push("updated_at = NOW()")

    await execute(`UPDATE model_pools SET ${sets.join(", ")} WHERE id = $1`, params)
    return NextResponse.json({ success: true })
  } catch (err) { console.error("model-pool patch error:", err); return NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    // Null out channels first
    await execute("UPDATE channels SET model_pool_id = NULL WHERE model_pool_id = $1", [id])
    await execute("DELETE FROM model_pools WHERE id = $1", [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("model-pool delete error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
