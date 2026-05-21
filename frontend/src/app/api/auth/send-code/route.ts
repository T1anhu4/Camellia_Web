import { NextRequest, NextResponse } from "next/server"
import { queryOne, execute } from "@/lib/db"
import { generateCode, sendVerificationCode } from "@/lib/email"

// Whether a real SMTP is configured (not Mailpit/local catch-all)
const hasRealSMTP = !!(process.env.SMTP_HOST && process.env.SMTP_HOST !== "mailpit")

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email?.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    // Upsert code (one active per email+purpose)
    await execute(
      `DELETE FROM verification_codes WHERE email = $1 AND purpose = 'login'`,
      [email.toLowerCase().trim()]
    )
    await execute(
      `INSERT INTO verification_codes (email, code, purpose, expires_at)
       VALUES ($1, $2, 'login', $3)`,
      [email.toLowerCase().trim(), code, expiresAt]
    )

    const sent = await sendVerificationCode(email, code)
    if (!sent) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    // In dev mode (no real SMTP), return the code directly so the user can see it
    if (!hasRealSMTP) {
      return NextResponse.json({ success: true, code, devMode: true })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("send-code error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
