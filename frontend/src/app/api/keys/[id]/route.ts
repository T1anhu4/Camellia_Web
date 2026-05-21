import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { execute } from "@/lib/db"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Only allow deleting own keys (admin can override)
    const result = await execute(
      `DELETE FROM api_keys WHERE id = $1 AND user_id = $2`,
      [id, session.sub]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("key delete error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
