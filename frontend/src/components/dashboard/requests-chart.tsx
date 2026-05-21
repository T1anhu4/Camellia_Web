"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useI18n } from "@/lib/i18n"

interface RequestsChartProps { data: Array<{ date: string; requests: number }> }

export function RequestsChart({ data }: RequestsChartProps) {
  const { t } = useI18n()
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-[200px] text-surface-500 text-sm">{t("common.noData")}</div>
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e6e6e6", borderRadius: 12, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }} labelStyle={{ color: "#666" }} formatter={(value: number) => [value.toLocaleString(), t("dashboard.chart.tooltipRequests")]} />
        <Bar dataKey="requests" fill="#666" radius={[4, 4, 0, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  )
}
