"use client"

import { motion } from "framer-motion"
import { ArrowRight, Zap, Shield, Layers, BarChart3, Key, Globe } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n"
import { ModelCarousel } from "@/components/landing/model-carousel"
import { NavBar } from "@/components/layout/nav-bar"

export default function LandingPage() {
  const { t, lang } = useI18n()
  const router = useRouter()

  return (
    <main className="min-h-screen bg-surface-50">
      <NavBar />

      {/* Hero */}
      <section className="container-page section-py pt-[120px] md:pt-[160px]">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-6">
          <span className="tag-blue">{lang === "zh" ? "Camellia 山茶花" : "Camellia"}</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }}
          className="font-bold text-[36px] sm:text-[48px] md:text-[64px] lg:text-[80px] leading-[1.05] tracking-tight max-w-4xl"
        >
          {lang === "zh" ? "一个统一 API 网关，让 AI 功能上线速度提升 10 倍" : "Ship AI features 10x faster with one unified API"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="text-[18px] md:text-[20px] text-surface-800 max-w-2xl mt-8 md:mt-10 leading-relaxed"
        >
          {lang === "zh"
            ? "路由、负载均衡、监控、计费 — 一站式管理所有大模型 API，完全兼容 OpenAI 协议。"
            : "Route, load-balance, monitor, and bill — manage all your LLM APIs from a single platform. Fully OpenAI compatible."}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-4 mt-10"
        >
          <button onClick={() => router.push("/login")} className="btn-primary">
            {lang === "zh" ? "免费开始使用" : "Start Free"}
            <ArrowRight className="ml-2 w-4 h-4" />
          </button>
          <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="btn-secondary">
            {lang === "zh" ? "了解更多" : "Learn More"}
          </button>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-16 md:mt-24 pt-10 border-t border-surface-200 flex flex-wrap gap-x-16 gap-y-6"
        >
          {[
            { v: `OpenAI Compatible`, l: lang === "zh" ? "完全兼容 OpenAI 协议" : "Fully OpenAI Compatible" },
            { v: `<${lang === "zh" ? "5毫秒" : "5ms"}`, l: lang === "zh" ? "Go Fiber 网关路由延迟" : "Go Fiber Routing Latency" },
            { v: lang === "zh" ? "多厂商" : "Multi-Provider", l: lang === "zh" ? "统一接入主流大模型" : "All major LLM providers" },
            { v: `256K`, l: lang === "zh" ? "并发连接支撑" : "Concurrent Connections" },
          ].map(s => (
            <div key={s.l}>
              <div className="text-[28px] md:text-[36px] font-bold">{s.v}</div>
              <div className="text-sm text-surface-600 mt-1">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Model Pool — scrolling carousel */}
      <section id="models" className="bg-white section-py">
        <div className="container-page">
          <div className="section-header">{lang === "zh" ? "模型池" : "Model Pool"}</div>
          <h2 className="section-title max-w-3xl mt-3 mb-4">
            {lang === "zh" ? "领先 AI 模型与无缝集成" : "Leading AI Models & Seamless Integration"}
          </h2>
          <p className="section-subtitle max-w-xl mb-8">
            {lang === "zh" ? "接入主流大模型，一个 API 全调度。添加渠道即刻上线。" : "Access all major LLMs through a single API. Add channels and go live instantly."}
          </p>
          <ModelCarousel />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container-page section-py">
        <div className="section-header">{lang === "zh" ? "核心能力" : "Core Features"}</div>
        <h2 className="section-title max-w-3xl mt-3 mb-4">
          {lang === "zh" ? "开箱即用，快速上线" : "Everything you need to go live"}
        </h2>
        <p className="section-subtitle max-w-xl mb-12">
          {lang === "zh" ? "无需重复造轮子，我们已为你准备好一切。" : "Stop reinventing the wheel. We've built it all for you."}
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {[
            { i: Layers, t: lang === "zh" ? "渠道池负载均衡" : "Channel Pool LB", d: lang === "zh" ? "多供应商 API Key 统一管理，优先级、权重、最少连接三级智能调度，故障自动切换。" : "Multi-provider key management with 3-tier routing: priority, weight, least-connections." },
            { i: Shield, t: lang === "zh" ? "智能熔断保护" : "Circuit Breaker", d: lang === "zh" ? "三态熔断器 Closed→Open→Half-Open，401/403 即时断路，429 快速恢复。" : "3-state circuit breaker with per-status-code cooldown. Instant trip on auth failure." },
            { i: Zap, t: lang === "zh" ? "极低延迟 SSE 流式" : "SSE Streaming", d: lang === "zh" ? "Go Fiber 构建，<5ms 路由开销，零缓冲 SSE 流式转发，256K 并发。" : "Built on Go Fiber, <5ms overhead. Zero-buffer SSE streaming, 256K concurrent." },
            { i: BarChart3, t: lang === "zh" ? "实时用量图表" : "Usage Analytics", d: lang === "zh" ? "Token 消耗趋势、费用分布、请求数统计，7天/30天自由切换。" : "Token trends, cost breakdown, request stats. 7d/30d toggles." },
            { i: Key, t: lang === "zh" ? "API Key 管理" : "API Key Mgmt", d: lang === "zh" ? "SHA-256 哈希存储，创建后仅展示一次，Redis 缓存亚毫秒鉴权。" : "SHA-256 hashed, shown once on creation. Redis-cached sub-ms auth." },
            { i: Globe, t: lang === "zh" ? "完全兼容 OpenAI" : "OpenAI Compatible", d: lang === "zh" ? "直接替换 base_url，零代码改动接入。支持 Chat、Embeddings、Models 全部端点。" : "Drop-in base_url replacement. Chat, Embeddings, Models endpoints." },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="card bg-surface-50 p-6 md:p-8 group"
            >
              <div className="w-10 h-10 rounded-xl bg-surface-950 flex items-center justify-center mb-6">
                <f.i className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2">{f.t}</h3>
              <p className="text-surface-700 text-sm leading-relaxed">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white section-py">
        <div className="container-page text-center">
          <h2 className="section-title mb-4">
            {lang === "zh" ? "准备好开始了吗？" : "Ready to start?"}
          </h2>
          <p className="section-subtitle mb-8 max-w-md mx-auto">
            {lang === "zh" ? "2 分钟获取 API Key，无需信用卡。" : "Get API keys in 2 minutes. No credit card required."}
          </p>
          <button onClick={() => router.push("/login")} className="btn-primary text-lg px-12">
            {lang === "zh" ? "免费注册账号" : "Create Free Account"}
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200">
        <div className="container-page py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-surface-600">
          <div className="flex items-center gap-2 font-bold text-surface-950">Camellia</div>
          <div className="flex gap-6">
            <Link href="/models" className="hover:text-surface-900 transition-colors">{lang === "zh" ? "模型" : "Models"}</Link>
            <Link href="/docs" className="hover:text-surface-900 transition-colors">{lang === "zh" ? "文档" : "Docs"}</Link>
            <Link href="/login" className="hover:text-surface-900 transition-colors">{lang === "zh" ? "登录" : "Sign In"}</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Camellia. {lang === "zh" ? "为开发者而生。" : "Built for builders."}</p>
        </div>
      </footer>
    </main>
  )
}

