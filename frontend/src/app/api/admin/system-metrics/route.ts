import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import os from "os"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    const cpus = os.cpus()
    const loadAvg = os.loadavg()

    return NextResponse.json({
      system: {
        platform: os.platform(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || "Unknown",
        cpuUsage: Math.round(loadAvg[0] * 100) / 100,
        loadAvg: [loadAvg[0], loadAvg[1], loadAvg[2]].map(v => Math.round(v * 100) / 100),
        totalMemoryMB: Math.round(totalMem / 1024 / 1024),
        usedMemoryMB: Math.round(usedMem / 1024 / 1024),
        freeMemoryMB: Math.round(freeMem / 1024 / 1024),
        memoryUsagePercent: Math.round((usedMem / totalMem) * 100),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    })
  } catch (err) {
    console.error("system metrics error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
