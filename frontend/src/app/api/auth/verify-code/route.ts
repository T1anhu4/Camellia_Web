import { NextRequest, NextResponse } from "next/server"
import { queryOne, execute } from "@/lib/db"
import { signToken, setSessionCookie } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()
    if (!email || !code) {
      return NextResponse.json({ error: "Email and code required" }, { status: 400 })
    }

    // Look up valid code
    const vc = await queryOne<{
      id: string; email: string; code: string; used: boolean; expires_at: string
    }>(
      `SELECT * FROM verification_codes
       WHERE email = $1 AND purpose = 'login'
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase().trim()]
    )

    if (!vc || vc.used || new Date(vc.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 })
    }

    if (vc.code !== code) {
      return NextResponse.json({ error: "Incorrect code" }, { status: 401 })
    }

    // Mark code used
    await execute("UPDATE verification_codes SET used = true WHERE id = $1", [vc.id])

    // Find or create user
    let user = await queryOne<{
      id: string; email: string; nickname: string | null; role: string;
      subscription_tier: string; status: string;
    }>(
      `SELECT id, email, nickname, role::text, subscription_tier::text, status::text
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    )

    if (!user) {
      // Auto-register new user
      user = await queryOne<{
        id: string; email: string; nickname: string | null; role: string;
        subscription_tier: string; status: string;
      }>(
        `INSERT INTO users (email, password_hash, nickname, role, status, daily_token_quota)
         VALUES ($1, '', $2, 'user', 'active', 10000)
         RETURNING id, email, nickname, role::text, subscription_tier::text, status::text`,
        [email.toLowerCase().trim(), email.split("@")[0]]
      )
    }

    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 })
    }

    // Sign JWT
    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role as "user" | "admin",
      tier: user.subscription_tier,
    })

    // Set cookie
    const cookie = setSessionCookie(token)
    const res = NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        tier: user.subscription_tier,
      },
    })

    res.cookies.set(cookie.name, cookie.value, cookie.options as any)
    return res
  } catch (err) {
    console.error("verify-code error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
