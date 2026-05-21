"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useI18n } from "@/lib/i18n"

interface TokenChartProps {
  data: Array<{ date: string; tokens: number }>
}

export function TokenChart({ data }: TokenChartProps) {
  const { t } = useI18n()

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-gray-500 text-sm">
        {t("common.noData")}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
        <Tooltip
          contentStyle={{ background: "#fff", border: "1px solid #e6e6e6", borderRadius: 12, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
          labelStyle={{ color: "#666" }}
          formatter={(value: number) => [value.toLocaleString(), t("dashboard.chart.tooltipTokens")]}
        />
        <Area
          type="monotone"
          dataKey="tokens"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#tokenGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
