import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

interface ProviderConfig {
  name: string
  label: string
  balanceUrl: string
  headerName: string
  headerValue: (token: string) => string
  parseBalance: (data: any) => { totalBalance: number; currency: string } | null
}

const providers: Record<string, ProviderConfig> = {
  deepseek: {
    name: "deepseek",
    label: "DeepSeek 官方",
    balanceUrl: "https://api.deepseek.com/user/balance",
    headerName: "Authorization",
    headerValue: (token) => `Bearer ${token}`,
    parseBalance: (data: any) => {
      if (!data?.balance_infos?.length) return null
      const info = data.balance_infos[0]
      return {
        totalBalance: parseFloat(info.total_balance || "0"),
        currency: info.currency || "CNY",
      }
    },
  },
  proaiapi: {
    name: "proaiapi",
    label: "proaiapi",
    // proaiapi uses email:password login flow — handled specially in POST
    balanceUrl: "",
    headerName: "",
    headerValue: () => "",
    parseBalance: () => null,
  },
}

async function checkProaiapiBalance(token: string): Promise<{ totalBalance: number; currency: string } | null> {
  // Token format: email:password
  const parts = token.split(":")
  if (parts.length < 2) return null
  const username = parts[0]
  const password = parts.slice(1).join(":") // password may contain colons

  try {
    // Step 1: Login
    const loginRes = await fetch("https://proaiapi.tech/api/user/login?turnstile=", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(8000),
    })
    if (!loginRes.ok) return null
    const loginData = await loginRes.json()
    if (!loginData.success || !loginData.data?.id) return null

    const userId = loginData.data.id
    const sessionCookie = loginRes.headers.get("set-cookie") || ""

    // Step 2: Get user/self with session cookie + New-Api-User header
    const selfRes = await fetch("https://proaiapi.tech/api/user/self", {
      headers: {
        "Cookie": sessionCookie,
        "New-Api-User": String(userId),
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!selfRes.ok) return null
    const selfData = await selfRes.json()
    if (!selfData.success || !selfData.data) return null

    // proaiapi balance = quota (remaining tokens in the account)
    const quota = selfData.data.quota || 0
    const usedQuota = selfData.data.used_quota || 0
    // quota is the remaining amount in the proaiapi account's unit (likely RMB cents equivalent)
    // Return as "total balance" in the same unit
    return {
      totalBalance: quota / 500000, // proaiapi quota: ~500000 per yuan
      currency: "CNY",
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { provider, token } = await req.json()
    if (!provider || !token) {
      return NextResponse.json({ error: "provider and token required" }, { status: 400 })
    }

    // Special handling for proaiapi (login-based balance check)
    if (provider === "proaiapi") {
      const result = await checkProaiapiBalance(token)
      if (!result) {
        return NextResponse.json({ error: "Failed to fetch proaiapi balance" }, { status: 502 })
      }
      return NextResponse.json({
        provider: "proaiapi",
        total_balance: result.totalBalance,
        currency: result.currency,
        balance_cents: Math.round(result.totalBalance * 100),
      })
    }

    const config = providers[provider]
    if (!config) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    const res = await fetch(config.balanceUrl, {
      headers: {
        "Accept": "application/json",
        [config.headerName]: config.headerValue(token),
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream returned ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const balance = config.parseBalance(data)

    if (!balance) {
      return NextResponse.json({ error: "Failed to parse balance", raw: data }, { status: 502 })
    }

    return NextResponse.json({
      provider: config.name,
      total_balance: balance.totalBalance,
      currency: balance.currency,
      balance_cents: Math.round(balance.totalBalance * 100),
    })
  } catch (err) {
    console.error("check-balance error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json(Object.keys(providers).map(k => ({
      name: providers[k].name,
      label: providers[k].label,
    })))
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
