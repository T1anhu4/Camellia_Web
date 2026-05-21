"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Layers, Server, Activity, AlertCircle, Loader2, Cpu, ExternalLink } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import Link from "next/link"

interface ProviderInfo {
  name: string
  models: string[]
  channelCount: number
  activeCount: number
}

interface PoolData {
  models: string[]
  providers: ProviderInfo[]
  totalChannels: number
}

export function ModelPoolShowcase() {
  const { t } = useI18n()
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/public/models")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="glass p-8 rounded-2xl">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{t("common.retry")}</p>
      </div>
    )
  }

  // Empty state — no channels configured yet
  if (!data || data.totalChannels === 0) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <Server className="w-10 h-10 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-300 mb-2">
          Token 池尚未配置
        </h3>
        <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
          还没有添加任何上游大模型渠道。添加 OpenAI、Azure 或其他供应商的 API Key 后，支持的模型将在这里展示。
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
        >
          登录并配置渠道 <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <div className="glass p-6 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-sm font-semibold text-gray-200">
            Token 模型池
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {data.totalChannels} 个渠道 · {data.models.length} 个可用模型
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">运行中</span>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {data.providers.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-surface-900/60 rounded-xl p-4 border border-white/5"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-200 capitalize">{p.name}</div>
                <div className="text-xs text-gray-500">
                  {p.activeCount}/{p.channelCount} 渠道活跃
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.models.map((m) => (
                <span
                  key={m}
                  className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-300 text-xs font-mono border border-brand-500/20"
                >
                  {m}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* All Models Summary */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-500 font-medium">全部可用模型</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.models.map((m) => (
            <span
              key={m}
              className="px-2.5 py-1 rounded-lg bg-surface-800 text-gray-300 text-xs font-mono"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
