import { NextRequest, NextResponse } from "next/server"
import { queryOne, execute } from "@/lib/db"
import { signToken, setSessionCookie } from "@/lib/auth"
import { generateCode, sendVerificationCode } from "@/lib/email"
import crypto from "crypto"

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "llmgw_salt_v2").digest("hex")
}

// Step 1: POST { email, username, password } → send code
// Step 2: POST { email, username, password, code } → verify + create user
export async function POST(req: NextRequest) {
  try {
    const { email, username, password, code } = await req.json()

    if (!email?.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }
    if (!username || username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_一-龥一-鿿]+$/.test(username)) {
      return NextResponse.json({ error: "Username must be 3-30 characters, alphanumeric or Chinese" }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const emailLower = email.toLowerCase().trim()
    const usernameTrim = username.trim()

    // Check uniqueness
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [emailLower, usernameTrim]
    )
    if (existing) {
      return NextResponse.json({ error: "Email or username already registered" }, { status: 409 })
    }

    // Step 1: Send verification code
    if (!code) {
      const vcode = generateCode()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      // Clean up old codes for this email
      await execute(
        "DELETE FROM verification_codes WHERE email = $1 AND purpose = 'register'",
        [emailLower]
      )
      await execute(
        `INSERT INTO verification_codes (email, code, purpose, expires_at) VALUES ($1, $2, 'register', $3)`,
        [emailLower, vcode, expiresAt]
      )

      const sent = await sendVerificationCode(emailLower, vcode)
      if (!sent) {
        return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 })
      }

      return NextResponse.json({ needVerify: true })
    }

    // Step 2: Verify code and create user
    const vc = await queryOne<{ id: string; code: string; used: boolean; expires_at: string }>(
      `SELECT id, code, used, expires_at FROM verification_codes
       WHERE email = $1 AND purpose = 'register' ORDER BY created_at DESC LIMIT 1`,
      [emailLower]
    )

    if (!vc || vc.used || new Date(vc.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 })
    }
    if (vc.code !== String(code).trim()) {
      return NextResponse.json({ error: "Incorrect verification code" }, { status: 400 })
    }

    // Mark code as used
    await execute("UPDATE verification_codes SET used = true WHERE id = $1", [vc.id])

    // Create user
    const pwHash = hashPassword(password)
    const user = await queryOne<{
      id: string; email: string; nickname: string | null; role: string;
      subscription_tier: string; status: string;
    }>(
      `INSERT INTO users (email, username, password_hash, nickname, role, status, daily_token_quota)
       VALUES ($1, $2, $3, $4, 'user', 'active', 10000)
       RETURNING id, email, username, nickname, role::text, subscription_tier::text, status::text`,
      [emailLower, usernameTrim, pwHash, usernameTrim]
    )

    if (!user) {
      return NextResponse.json({ error: "Registration failed" }, { status: 500 })
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
      user: { id: user.id, email: user.email, username: usernameTrim, nickname: user.nickname, role: user.role, tier: user.subscription_tier },
    })
    res.cookies.set(cookie.name, cookie.value, cookie.options as any)
    return res
  } catch (err) {
    console.error("register error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
