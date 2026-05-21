import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryOne, execute } from "@/lib/db"
import crypto from "crypto"

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "llmgw_salt_v2").digest("hex")
}

// Change current user's password
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { oldPassword, newPassword } = await req.json()
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Old and new password required" }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 })
    }

    // Verify old password
    const user = await queryOne<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [session.sub]
    )
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const oldHash = hashPassword(oldPassword)
    if (user.password_hash !== oldHash) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    // Update password
    const newHash = hashPassword(newPassword)
    await execute("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [newHash, session.sub])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("password change error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
