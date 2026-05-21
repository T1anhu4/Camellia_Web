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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
        />
        <Tooltip
          contentStyle={{
            background: "rgb(30, 41, 59)",
            border: "1px solid rgb(51, 65, 85)",
            borderRadius: 12,
            fontSize: 13,
          }}
          labelStyle={{ color: "#94a3b8" }}
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
