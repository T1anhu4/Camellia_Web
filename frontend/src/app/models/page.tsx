"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Cpu, Loader2, Check, FileText, Image, File, Video, Mic } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { getModelMeta, type ModelMeta } from "@/lib/models"
import { NavBar } from "@/components/layout/nav-bar"

const capabilityIcons: Record<string, React.ComponentType<any>> = { text: FileText, image: Image, file: File, video: Video, voice: Mic }

export default function ModelsPage() {
  const { t, lang } = useI18n()
  const [modelMetas, setModelMetas] = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState(true)
  const isZH = lang === "zh"

  useEffect(() => {
    fetch("/api/public/models")
      .then(r => r.json())
      .then(d => { setModelMetas(((d.models || []) as string[]).map(m => getModelMeta(m))) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-surface-50">
      <NavBar />
      <div className="max-w-[1440px] mx-auto px-[16px] md:px-[28px] xl:px-[60px] 2xl:px-[107px] pt-[100px] md:pt-[120px] pb-[80px] md:pb-[120px]">
        <div className="mb-10">
          <h1 className="text-[36px] md:text-[48px] font-bold tracking-tight">{isZH ? "模型库" : "Model Library"}</h1>
          <p className="text-surface-700 text-lg mt-2">
            {isZH ? `${modelMetas.length} 个模型可用。通过统一 API 调用所有模型。` : `${modelMetas.length} models available. Access all through a single API.`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-surface-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : modelMetas.length === 0 ? (
          <div className="text-center py-32 text-surface-500">
            <Cpu className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">{isZH ? "暂无可用模型" : "No models available"}</p>
            <p className="text-sm mt-2">{isZH ? "请在管理后台添加渠道以启用模型" : "Add channels in Admin to enable models"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {modelMetas.map(meta => (
              <div key={meta.name} className="bg-white border border-surface-200 rounded-[20px] p-5 md:p-6 flex flex-col hover:border-surface-300 hover:shadow-sm transition-all duration-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="shrink-0 mt-1">{meta.logo(28)}</div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg leading-tight truncate">{meta.name}</h3>
                    <div className="text-sm text-surface-600">{meta.providerLabel}</div>
                  </div>
                </div>
                <p className="text-sm text-surface-700 leading-relaxed mb-4 line-clamp-3 flex-1">{isZH ? meta.descriptionZH : meta.description}</p>

                <div className="flex items-center gap-2 mb-4">
                  {(["text","image","file","video","voice"] as const).map(type => {
                    const has = meta.inputTypes.includes(type) || meta.outputTypes.includes(type)
                    const Icon = capabilityIcons[type]
                    return <div key={type} className="flex items-center gap-0.5"><Icon className={`w-4 h-4 ${has ? "text-surface-700" : "text-surface-300"}`} />{has && <Check className="w-2.5 h-2.5 text-emerald-500 -ml-0.5 -mt-1.5" />}</div>
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm border-t border-surface-100 pt-4">
                  <div><div className="text-surface-500 text-xs mb-0.5">{isZH ? "上下文" : "Context"}</div><div className="font-semibold text-surface-800">{meta.contextWindow}</div></div>
                  <div><div className="text-surface-500 text-xs mb-0.5">{isZH ? "最大输出" : "Max Output"}</div><div className="font-semibold text-surface-800">{meta.maxOutput}</div></div>
                </div>

                <div className="flex gap-4 text-sm mt-3">
                  <div><div className="text-surface-500 text-xs mb-0.5">{isZH ? "输入价格" : "Input"}</div><div className="font-semibold text-surface-800">{meta.inputPrice}<span className="text-surface-400 text-xs font-normal">/M tokens</span></div></div>
                  <div><div className="text-surface-500 text-xs mb-0.5">{isZH ? "输出价格" : "Output"}</div><div className="font-semibold text-surface-800">{meta.outputPrice}<span className="text-surface-400 text-xs font-normal">/M tokens</span></div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
