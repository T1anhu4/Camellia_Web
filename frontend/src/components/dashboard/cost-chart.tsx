"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useI18n } from "@/lib/i18n"

interface CostChartProps {
  data: Array<{ date: string; cost: number }>
}

export function CostChart({ data }: CostChartProps) {
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
      <BarChart data={data}>
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
          tickFormatter={(v: number) => `$${(v / 100).toFixed(2)}`}
        />
        <Tooltip
          contentStyle={{
            background: "rgb(30, 41, 59)",
            border: "1px solid rgb(51, 65, 85)",
            borderRadius: 12,
            fontSize: 13,
          }}
          labelStyle={{ color: "#94a3b8" }}
          formatter={(value: number) => [`$${(value / 100).toFixed(4)}`, t("dashboard.chart.tooltipCost")]}
        />
        <Bar
          dataKey="cost"
          fill="#6366f1"
          radius={[4, 4, 0, 0]}
          barSize={12}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
