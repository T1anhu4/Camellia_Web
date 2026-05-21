import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryOne } from "@/lib/db"

// POST /api/billing/checkout — create a checkout session for subscription or top-up
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { plan_id, mode } = await req.json() // mode: "subscription" | "topup"

    // Look up the plan
    const plan = await queryOne<{
      id: string; name: string; tier: string;
      price_monthly_cents: number; price_yearly_cents: number;
    }>(
      `SELECT id, name, tier, price_monthly_cents, price_yearly_cents
       FROM subscription_plans WHERE id = $1 AND is_active = true`,
      [plan_id]
    )

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    // Get user info
    const user = await queryOne<{ email: string }>(
      "SELECT email FROM users WHERE id = $1", [session.sub]
    )
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Build checkout request for payment provider
    const amountCents = mode === "subscription" ? plan.price_monthly_cents : 0

    // In production: call StripeProvider.CreateCheckout()
    // For now: return a stub response
    const checkoutURL = `/dashboard?checkout=stub&plan=${plan.tier}&amount=${amountCents}`

    return NextResponse.json({
      url: checkoutURL,
      session_id: `cs_${Date.now()}`,
      plan: plan.tier,
      amount_cents: amountCents,
      mode,
    })
  } catch (err) {
    console.error("checkout error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
