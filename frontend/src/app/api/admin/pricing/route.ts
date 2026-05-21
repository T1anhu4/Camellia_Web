import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryMany, queryOne, execute } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const pricing = await queryMany(
      `SELECT id, model_name, model_display,
              cost_input_price, cost_output_price,
              sell_input_price, sell_output_price,
              vip_discount, enterprise_discount, is_active, created_at
       FROM model_pricing ORDER BY model_name`
    )
    return NextResponse.json(pricing)
  } catch (err) {
    console.error("admin pricing error:", err)
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
    const { model_name, model_display, cost_input_price, cost_output_price,
            sell_input_price, sell_output_price, vip_discount, enterprise_discount } = body

    if (!model_name) {
      return NextResponse.json({ error: "model_name required" }, { status: 400 })
    }

    const p = await queryOne<{ id: string }>(
      `INSERT INTO model_pricing
       (model_name, model_display, cost_input_price, cost_output_price,
        sell_input_price, sell_output_price, vip_discount, enterprise_discount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (model_name) DO UPDATE SET
         model_display = EXCLUDED.model_display,
         cost_input_price = EXCLUDED.cost_input_price,
         cost_output_price = EXCLUDED.cost_output_price,
         sell_input_price = EXCLUDED.sell_input_price,
         sell_output_price = EXCLUDED.sell_output_price,
         vip_discount = EXCLUDED.vip_discount,
         enterprise_discount = EXCLUDED.enterprise_discount,
         updated_at = NOW()
       RETURNING id`,
      [
        model_name, model_display || model_name,
        cost_input_price || 0, cost_output_price || 0,
        sell_input_price || 0, sell_output_price || 0,
        vip_discount || 0.9, enterprise_discount || 0.8,
      ]
    )

    return NextResponse.json({ id: p?.id })
  } catch (err) {
    console.error("admin pricing create error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id, is_active } = await req.json()
    await execute(
      "UPDATE model_pricing SET is_active = $1, updated_at = NOW() WHERE id = $2",
      [is_active, id]
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("admin pricing patch error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
