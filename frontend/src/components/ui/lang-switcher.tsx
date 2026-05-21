"use client"

import { useI18n } from "@/lib/i18n"
import { Globe } from "lucide-react"

export function LangSwitcher() {
  const { lang, setLang, t } = useI18n()

  return (
    <button
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
      title={t("lang.switch")}
    >
      <Globe className="w-4 h-4" />
      <span>{t("lang.switch")}</span>
    </button>
  )
}
