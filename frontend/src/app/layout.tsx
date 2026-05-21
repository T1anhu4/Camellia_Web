import type { Metadata } from "next"
import { RootLayoutClient } from "./layout-client"

export const metadata: Metadata = {
  title: "Camellia — 山茶花 · 大模型 API 调度平台",
  description:
    "Camellia 山茶花 — 大模型 API 调度平台，支持多厂商渠道池、负载均衡、自动熔断和按量计费",
  keywords: ["Camellia", "API网关", "AI", "大模型", "OpenAI", "负载均衡", "LLM"],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RootLayoutClient>{children}</RootLayoutClient>
}
