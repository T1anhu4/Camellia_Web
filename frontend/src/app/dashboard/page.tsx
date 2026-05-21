"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { cn, formatTokens, formatCents } from "@/lib/utils"
import { TokenChart } from "@/components/dashboard/token-chart"
import { CostChart } from "@/components/dashboard/cost-chart"
import { RequestsChart } from "@/components/dashboard/requests-chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "@/components/ui/lang-switcher"
import { useDashboard } from "@/hooks/use-dashboard"

export default function DashboardPage() {
  const { t } = useI18n()
  const { user } = useDashboard()

  return (
    <>
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {t("dashboard.welcome", { name: user?.nickname || user?.email?.split("@")[0] || "" })}
          </p>
        </div>
        <LangSwitcher />
      </header>

      <UsageTab />
    </>
  )
}

// ============================================================
// Usage Tab
// ============================================================
function UsageTab() {
  const { t } = useI18n()
  const [period, setPeriod] = useState("30d")
  const [usageData, setUsageData] = useState<any[]>([])
  const [totals, setTotals] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const end = new Date().toISOString().split("T")[0]
      const start = new Date(Date.now() - (period === "7d" ? 7 : 30) * 86400000)
        .toISOString()
        .split("T")[0]
      const res = await api.getUsage(start, end)
      setUsageData(res.data)
      setTotals(res.totals)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 p-1 bg-surface-800/50 rounded-xl">
          {["7d", "30d"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                period === p ? "bg-brand-600 text-white" : "text-gray-400 hover:text-gray-200"
              )}
            >
              {p === "7d" ? t("dashboard.period.7days") : t("dashboard.period.30days")}
            </button>
          ))}
        </div>
        <button onClick={load} className="btn-secondary text-xs py-1.5 px-3" disabled={loading}>
          <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
          {t("common.refresh")}
        </button>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass p-5 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass p-12 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={load} className="btn-secondary">{t("common.retry")}</button>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t("dashboard.stats.totalTokens")} value={formatTokens(totals?.total_tokens || 0)} />
            <StatCard label={t("dashboard.stats.totalRequests")} value={String(totals?.total_requests || 0)} />
            <StatCard label={t("dashboard.stats.totalCost")} value={formatCents(totals?.total_cost || 0)} />
            <StatCard label={t("dashboard.stats.avgTokens")} value={totals?.total_requests > 0 ? formatTokens(Math.round(totals.total_tokens / totals.total_requests)) : "0"} />
          </div>

          {/* Charts */}
          {usageData.length === 0 ? (
            <div className="glass p-12 text-center text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t("dashboard.empty")}</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="glass p-6">
                <h3 className="font-semibold mb-4">{t("dashboard.chart.tokenTitle")}</h3>
                <TokenChart data={usageData} />
              </div>
              <div className="glass p-6">
                <h3 className="font-semibold mb-4">{t("dashboard.chart.costTitle")}</h3>
                <CostChart data={usageData} />
              </div>
              <div className="glass p-6">
                <h3 className="font-semibold mb-4">{t("dashboard.chart.requestTitle")}</h3>
                <RequestsChart data={usageData} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-hover p-5">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
