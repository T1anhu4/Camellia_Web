import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryMany, queryOne, execute } from "@/lib/db"
import crypto from "crypto"

const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef", "utf8"
).slice(0, 32)

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64")
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const channels = await queryMany<any>(
      `SELECT id, name, provider::text, base_url, models, weight, priority,
              max_concurrency, status::text, error_count, cost_multiplier,
              last_health_check, created_at
       FROM channels ORDER BY priority DESC, weight DESC`
    )

    return NextResponse.json(channels)
  } catch (err) {
    console.error("admin channels error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { name, provider, api_key, base_url, models, weight, priority, max_concurrency } = body

    if (!name || !api_key || !base_url) {
      return NextResponse.json({ error: "name, api_key, and base_url are required" }, { status: 400 })
    }

    // Convert models to PostgreSQL array: "a,b,c" → ["a","b","c"] or use as-is if array
    let modelsArr: string[]
    if (Array.isArray(models)) {
      modelsArr = models
    } else if (typeof models === "string") {
      modelsArr = models.split(",").map((m: string) => m.trim()).filter(Boolean)
    } else {
      modelsArr = ["gpt-4o-mini"]
    }

    const ch = await queryOne<{ id: string }>(
      `INSERT INTO channels (name, provider, api_key_enc, base_url, models, weight, priority, max_concurrency)
       VALUES ($1, $2::provider_type, $3, $4, $5::text[], $6, $7, $8)
       RETURNING id`,
      [
        name,
        provider || "openai",
        encrypt(api_key),
        base_url,
        modelsArr,
        weight || 1,
        priority || 0,
        max_concurrency || 10,
      ]
    )

    return NextResponse.json({ id: ch?.id })
  } catch (err) {
    console.error("admin channel create error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    // Set channel_id to NULL in related billing records first
    await execute("UPDATE billing_records SET channel_id = NULL WHERE channel_id = $1", [id])
    await execute("DELETE FROM channels WHERE id = $1", [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("admin channel delete error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
