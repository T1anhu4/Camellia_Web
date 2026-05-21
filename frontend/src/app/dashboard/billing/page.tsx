"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, RefreshCw, Zap, TrendingUp, DollarSign, Activity } from "lucide-react"
import { api } from "@/lib/api"
import { cn, formatTokens, formatCents } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { useAuth } from "@/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import { TokenChart } from "@/components/dashboard/token-chart"
import { CostChart } from "@/components/dashboard/cost-chart"
import { RequestsChart } from "@/components/dashboard/requests-chart"

export default function BillingPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  return (
    <>
      <header className="mb-8">
        <h1 className="text-[28px] md:text-[36px] font-bold">{t("nav.billing")}</h1>
        <p className="text-surface-600 text-sm mt-1">{t("billing.subtitle")}</p>
      </header>
      <BillingContent t={t} user={user} />
    </>
  )
}

function BillingContent({ t, user }: { t: any; user: any }) {
  const [period, setPeriod] = useState("30d")
  const [data, setData] = useState<any[]>([])
  const [totals, setTotals] = useState<any>(null)
  const [modelBreakdown, setModelBreakdown] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const end = new Date().toISOString().split("T")[0]
      const start = new Date(Date.now() - (period === "7d" ? 7 : 30) * 86400000).toISOString().split("T")[0]
      const res = await api.getUsage(start, end)
      setData(res.data || [])
      setTotals(res.totals || {})

      // Model breakdown from the data or API
      const models = await api.getModelUsage()
      setModelBreakdown(models || [])
    } catch {} finally { setLoading(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  const balanceTokens = (user?.daily_token_quota || 10000) - (user?.daily_token_used || 0)

  return (
    <div className="space-y-6">
      {/* Top: Balance summary */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-surface-50 p-5">
          <div className="flex items-center gap-2 text-sm text-surface-500 mb-2"><DollarSign className="w-4 h-4" />账户余额</div>
          <div className="text-[28px] font-bold">{formatCents(user?.balance_cents || 0)}</div>
          <div className="text-xs text-surface-500 mt-1">可用余额</div>
        </div>
        <div className="card bg-surface-50 p-5">
          <div className="flex items-center gap-2 text-sm text-surface-500 mb-2"><Zap className="w-4 h-4" />Token 余量</div>
          <div className="text-[28px] font-bold">{formatTokens(Math.max(0, balanceTokens))}</div>
          <div className="text-xs text-surface-500 mt-1">今日剩余 / 配额 {formatTokens(user?.daily_token_quota || 10000)}</div>
        </div>
        <div className="card bg-surface-50 p-5">
          <div className="flex items-center gap-2 text-sm text-surface-500 mb-2"><TrendingUp className="w-4 h-4" />今日用量</div>
          <div className="text-[28px] font-bold">{formatTokens(user?.daily_token_used || 0)}</div>
          <div className="text-xs text-surface-500 mt-1">Token 已消耗</div>
        </div>
        <div className="card bg-surface-50 p-5">
          <div className="flex items-center gap-2 text-sm text-surface-500 mb-2"><Activity className="w-4 h-4" />累计请求</div>
          <div className="text-[28px] font-bold">{totals?.total_requests?.toLocaleString() || 0}</div>
          <div className="text-xs text-surface-500 mt-1">总请求次数</div>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 bg-surface-100 rounded-lg p-1">
          {["7d", "30d"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", period === p ? "bg-surface-950 text-white" : "text-surface-600 hover:text-surface-900")}>
              {p === "7d" ? t("dashboard.period.7days") : t("dashboard.period.30days")}
            </button>
          ))}
        </div>
        <button onClick={load} className="btn-secondary text-sm py-1.5 px-3" disabled={loading}>
          <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />{t("common.refresh")}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card bg-white p-5 space-y-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-[200px] w-full" /></div>
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="card bg-white p-12 text-center text-surface-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无使用数据，发起你的第一个 API 请求吧</p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="card bg-white p-5"><h3 className="font-bold mb-4">Token 消耗趋势</h3><TokenChart data={data} /></div>
            <div className="card bg-white p-5"><h3 className="font-bold mb-4">费用分布</h3><CostChart data={data} /></div>
            <div className="card bg-white p-5"><h3 className="font-bold mb-4">请求数统计</h3><RequestsChart data={data} /></div>
          </div>

          {/* Model Breakdown Table */}
          <div className="card bg-white p-5">
            <h3 className="font-bold mb-4">模型用量明细</h3>
            {modelBreakdown.length === 0 ? (
              <p className="text-surface-500 text-sm text-center py-8">暂无模型调用记录</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left py-3 px-3 font-medium text-surface-500 uppercase text-xs">模型</th>
                    <th className="text-right py-3 px-3 font-medium text-surface-500 uppercase text-xs">请求数</th>
                    <th className="text-right py-3 px-3 font-medium text-surface-500 uppercase text-xs">Token 用量</th>
                    <th className="text-right py-3 px-3 font-medium text-surface-500 uppercase text-xs">费用</th>
                    <th className="text-right py-3 px-3 font-medium text-surface-500 uppercase text-xs">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {modelBreakdown.map((m: any, i: number) => {
                    const pct = totals?.total_tokens > 0 ? ((m.total_tokens || 0) / totals.total_tokens * 100).toFixed(1) : 0
                    return (
                      <tr key={i} className="border-b border-surface-100">
                        <td className="py-3 px-3 font-mono text-xs">{m.model_name}</td>
                        <td className="py-3 px-3 text-right">{(m.total_requests || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">{formatTokens(m.total_tokens || 0)}</td>
                        <td className="py-3 px-3 text-right">{formatCents(m.total_cost || 0)}</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                              <div className="h-full bg-surface-950 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-surface-500">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
