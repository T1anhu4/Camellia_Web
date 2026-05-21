import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { queryMany, queryOne, execute } from "@/lib/db"
import crypto from "crypto"
import { v4 as uuidv4 } from "uuid"

// List user API keys
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keys = await queryMany(
      `SELECT id, name, key_prefix, is_enabled, last_used_at, rpm_limit, tpm_limit, created_at
       FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [session.sub]
    )
    return NextResponse.json(keys)
  } catch (err) {
    console.error("keys list error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Create new API key
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keyName = "Key-" + new Date().toISOString().slice(0,16).replace("T","-")

    // Generate key: camellia-{32 random hex chars}
    const rawKey = "camellia-" + crypto.randomBytes(24).toString("hex")
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
    const keyPrefix = rawKey.slice(0, 12)

    const key = await queryOne<{ id: string }>(
      `INSERT INTO api_keys (user_id, key_hash, key_prefix, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [session.sub, keyHash, keyPrefix, keyName]
    )

    if (!key) {
      return NextResponse.json({ error: "Failed to create key" }, { status: 500 })
    }

    // Also cache in Redis for gateway fast-path
    try {
      const { redis } = await import("@/lib/redis")
      await redis.hset("apikey:" + keyHash, {
        user_id: session.sub,
        api_key_id: key.id,
        tier: session.tier,
      })
      await redis.expire("apikey:" + keyHash, 300)
    } catch {
      // Redis is optional — gateway falls back to DB
    }

    return NextResponse.json({
      id: key.id,
      key: rawKey,
      name: keyName,
      key_prefix: keyPrefix,
    })
  } catch (err) {
    console.error("key create error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
