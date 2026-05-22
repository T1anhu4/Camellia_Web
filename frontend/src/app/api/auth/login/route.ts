import { NextRequest, NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { signToken, setSessionCookie } from "@/lib/auth"
import crypto from "crypto"

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "llmgw_salt_v2").digest("hex")
}

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json()

    if (!login || !password) {
      return NextResponse.json({ error: "Email/username and password required" }, { status: 400 })
    }

    // Find by email or username
    const user = await queryOne<{
      id: string; email: string; username: string | null; nickname: string | null;
      password_hash: string; role: string; subscription_tier: string; status: string;
    }>(
      `SELECT id, email, username, nickname, password_hash, role::text, subscription_tier::text, status::text
       FROM users WHERE (email = $1 OR LOWER(username) = $1)`,
      [login.toLowerCase().trim()]
    )

    if (!user) {
      return NextResponse.json({ error: "Invalid email/username or password" }, { status: 401 })
    }

    if (user.status !== "active") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 })
    }

    const pwHash = hashPassword(password)
    if (user.password_hash !== pwHash) {
      return NextResponse.json({ error: "Invalid email/username or password" }, { status: 401 })
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role as "user" | "admin",
      tier: user.subscription_tier,
    })

    const cookie = setSessionCookie(token)
    const res = NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        nickname: user.nickname || user.username,
        role: user.role,
        tier: user.subscription_tier,
      },
    })
    res.cookies.set(cookie.name, cookie.value, cookie.options as any)
    return res
  } catch (err) {
    console.error("login error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
