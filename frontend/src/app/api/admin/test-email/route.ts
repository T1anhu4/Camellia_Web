import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sendVerificationCode } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { email } = await req.json()
    if (!email?.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const testCode = "888888"
    const sent = await sendVerificationCode(email, testCode)

    if (sent) {
      return NextResponse.json({ success: true, message: `测试邮件已发送至 ${email}，请检查收件箱` })
    } else {
      return NextResponse.json({ error: "邮件发送失败，请检查 SMTP 配置" }, { status: 500 })
    }
  } catch (err) {
    console.error("test-email error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
