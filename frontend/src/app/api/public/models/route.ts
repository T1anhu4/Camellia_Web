import { NextResponse } from "next/server"
import { queryMany } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await queryMany<{
      provider: string
      models: string[]
      channel_count: number
      active_count: number
    }>(
      `SELECT
         provider,
         array_agg(DISTINCT m.model) FILTER (WHERE m.model IS NOT NULL) AS models,
         COUNT(DISTINCT c.id) AS channel_count,
         COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active') AS active_count
       FROM channels c,
       LATERAL unnest(c.models) AS m(model)
       WHERE c.status != 'disabled'
       GROUP BY provider
       ORDER BY provider`
    )

    // Flatten all unique models across providers
    const allModels: string[] = []
    for (const row of rows) {
      if (row.models) {
        for (const m of row.models) {
          if (!allModels.includes(m)) {
            allModels.push(m)
          }
        }
      }
    }

    return NextResponse.json({
      models: allModels,
      providers: rows.map((r) => ({
        name: r.provider,
        models: r.models || [],
        channelCount: Number(r.channel_count),
        activeCount: Number(r.active_count),
      })),
      totalChannels: rows.reduce((sum, r) => sum + Number(r.channel_count), 0),
    })
  } catch (err) {
    console.error("public models error:", err)
    return NextResponse.json({ models: [], providers: [], totalChannels: 0 })
  }
}
