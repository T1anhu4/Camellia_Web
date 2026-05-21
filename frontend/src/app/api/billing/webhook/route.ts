import { NextRequest, NextResponse } from "next/server"
import { execute } from "@/lib/db"

// POST /api/billing/webhook — handle payment provider webhooks (Stripe, Alipay)
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("stripe-signature") || ""
    const payload = await req.text()

    // In production: verify webhook signature and process event
    // const event = stripeProvider.VerifyWebhook(payload, signature)

    // Stub: parse and log
    let event: any
    try {
      event = JSON.parse(payload)
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const eventType = event?.type || "unknown"
    const data = event?.data?.object || {}
    const metadata = data?.metadata || {}
    const userID = metadata?.user_id
    const planTier = metadata?.plan_tier || "vip"
    const amountCents = data?.amount_total || 0

    console.log(`[Webhook] ${eventType} user=${userID} plan=${planTier} amount=${amountCents}¢`)

    switch (eventType) {
      case "checkout.session.completed":
      case "payment_intent.succeeded":
        if (userID) {
          // Activate subscription
          await execute(
            `UPDATE users
             SET subscription_tier = $1::subscription_tier,
                 balance_cents = balance_cents + $2,
                 subscription_expires_at = NOW() + INTERVAL '30 days',
                 daily_token_quota = CASE
                   WHEN $1 = 'vip' THEN 100000
                   WHEN $1 = 'enterprise' THEN 1000000
                   ELSE daily_token_quota
                 END,
                 updated_at = NOW()
             WHERE id = $3`,
            [planTier, amountCents, userID]
          )
          console.log(`[Webhook] Activated ${planTier} subscription for user ${userID}`)
        }
        break

      case "customer.subscription.deleted":
        if (userID) {
          await execute(
            `UPDATE users
             SET subscription_tier = 'free',
                 daily_token_quota = 10000,
                 updated_at = NOW()
             WHERE id = $1`,
            [userID]
          )
          console.log(`[Webhook] Downgraded user ${userID} to free tier`)
        }
        break

      default:
        console.log(`[Webhook] Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("webhook error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
