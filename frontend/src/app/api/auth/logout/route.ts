import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"

export async function POST() {
  const cookie = clearSessionCookie()
  const res = NextResponse.json({ success: true })
  res.cookies.set(cookie.name, cookie.value, cookie.options as any)
  return res
}
