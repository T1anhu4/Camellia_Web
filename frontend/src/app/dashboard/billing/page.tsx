"use client"

import { useState, useEffect, useCallback } from "react"
import { CreditCard, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { cn, formatDate } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "@/components/ui/lang-switcher"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboard } from "@/hooks/use-dashboard"

interface TokenPackage {
  id: string
  key: string
  tokens: string
  priceYuan: string
  desc: string
  rate: string
}

const PACKAGES: TokenPackage[] = [
  { id: "5m", key: "billing.package.5m", tokens: "500万", priceYuan: "¥29", desc: "billing.package.5m.desc", rate: "¥0.0058/1K" },
  { id: "10m", key: "billing.package.10m", tokens: "1000万", priceYuan: "¥49", desc: "billing.package.10m.desc", rate: "¥0.0049/1K" },
  { id: "50m", key: "billing.package.50m", tokens: "5000万", priceYuan: "¥199", desc: "billing.package.50m.desc", rate: "¥0.0040/1K" },
  { id: "100m", key: "billing.package.100m", tokens: "1亿", priceYuan: "¥349", desc: "billing.package.100m.desc", rate: "¥0.0035/1K" },
]

export default function BillingPage() {
  const { t } = useI18n()
  const { user } = useDashboard()
  const [selected, setSelected] = useState<string>("5m")
  const [records, setRecords] = useState<any[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)

  const selectedPkg = PACKAGES.find((p) => p.id === selected)!

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true)
    try {
      const data = await api.getMyBillingRecords()
      setRecords(data)
    } catch {
      // silent
    } finally {
      setRecordsLoading(false)
    }
  }, [])

  useEffect(() => { loadRecords() }, [loadRecords])

  const balanceYuan = ((user?.balance_cents ?? 0) / 100).toFixed(2)

  const handleBuy = () => {
    toast.success(`${t("billing.buy")}: ${selectedPkg.priceYuan}`)
  }

  return (
    <>
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("billing.title")}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {t("billing.currentBalance")}: <span className="text-brand-400 font-semibold">¥{balanceYuan}</span>
          </p>
        </div>
        <LangSwitcher />
      </header>

      <div className="space-y-10">
        {/* Token package cards */}
        <section>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelected(pkg.id)}
                className={cn(
                  "glass-hover p-6 text-left transition-all duration-300",
                  selected === pkg.id
                    ? "ring-2 ring-brand-500 bg-brand-500/5 border-brand-500/30"
                    : ""
                )}
              >
                <div className="text-3xl font-bold mb-1">{pkg.tokens}</div>
                <div className="text-xs text-gray-500 mb-3">{t(pkg.desc)}</div>
                <div className="text-2xl font-bold text-brand-400 mb-1">{pkg.priceYuan}</div>
                <div className="text-xs text-gray-500 mb-4">{t("billing.perTokenRate")}: {pkg.rate}</div>
                <span className="btn-primary w-full text-sm py-2 inline-block text-center">
                  {t("billing.buy")}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Purchase form */}
        <section className="grid lg:grid-cols-3 gap-6">
          {/* Left: Package selection */}
          <div className="glass p-6 space-y-4">
            <h3 className="font-semibold">{t("billing.orderSummary")}</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">{t("billing.selectPackage")}</span>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="bg-surface-800 border border-surface-700 rounded-lg px-2 py-1 text-gray-200 text-sm"
                >
                  {PACKAGES.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {t(pkg.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t("billing.packagePrice")}</span>
                <span>{selectedPkg.priceYuan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t("billing.perTokenRate")}</span>
                <span>{selectedPkg.rate}</span>
              </div>
              <hr className="border-white/10" />
              <div className="flex justify-between font-semibold">
                <span>{t("billing.total")}</span>
                <span className="text-brand-400">{selectedPkg.priceYuan}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">{t("billing.currentBalance")}</span>
                <span>¥{balanceYuan}</span>
              </div>
            </div>

            <button onClick={handleBuy} className="btn-primary w-full">
              {t("billing.buy")} — {selectedPkg.priceYuan}
            </button>
          </div>

          {/* Center: Alipay QR */}
          <div className="glass p-6 flex flex-col items-center justify-center space-y-4">
            <h3 className="font-semibold text-center">{t("billing.alipay")}</h3>
            <p className="text-sm text-gray-400 text-center">{t("billing.scanQR")}</p>
            <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
              <div className="text-center text-gray-500">
                <CreditCard className="w-10 h-10 mx-auto mb-2 text-blue-400 opacity-50" />
                <span className="text-xs text-blue-400/60">支付宝</span>
                <br />
                <span className="text-xs text-gray-600">Alipay</span>
              </div>
            </div>
          </div>

          {/* Right: Payment info */}
          <div className="glass p-6 space-y-3">
            <h3 className="font-semibold">{t("billing.payment")}</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <p>1. {t("billing.selectPackage")}</p>
              <p>2. {t("billing.scanQR")}</p>
              <p>3. {t("billing.buy")}</p>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-gray-300">
              {selectedPkg.tokens} / {selectedPkg.priceYuan} / {selectedPkg.rate} per 1K tokens
            </div>
          </div>
        </section>

        {/* Transaction history */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t("billing.transactionHistory")}</h3>
            <button onClick={loadRecords} className="btn-secondary text-xs py-1.5 px-3" disabled={recordsLoading}>
              <RefreshCw className={cn("w-3 h-3 mr-1", recordsLoading && "animate-spin")} />
              {t("common.refresh")}
            </button>
          </div>

          {recordsLoading ? (
            <div className="glass p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="glass p-12 text-center text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t("billing.emptyHistory")}</p>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">{t("admin.billing.colTime")}</th>
                    <th className="text-left px-4 py-3">{t("admin.billing.colModel")}</th>
                    <th className="text-right px-4 py-3">{t("admin.billing.colTokens")}</th>
                    <th className="text-right px-4 py-3">{t("admin.billing.colCost")}</th>
                    <th className="text-right px-4 py-3">{t("admin.billing.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3">{r.model_name}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {r.total_tokens?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        ¥{(r.cost_cents / 100).toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            r.status === "success"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
