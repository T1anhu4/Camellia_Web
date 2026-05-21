"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Save, User, Lock } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { cn, formatDate } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "@/components/ui/lang-switcher"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboard } from "@/hooks/use-dashboard"

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const { user } = useDashboard()

  const [nickname, setNickname] = useState(user?.nickname || "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [stats, setStats] = useState<{ total_tokens: number; total_cost: number } | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await api.getMyStats()
      setStats(data)
    } catch {
      // silent
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    setNickname(user?.nickname || "")
  }, [user, loadStats])

  const handleSaveNickname = async () => {
    if (!nickname.trim()) {
      toast.error(t("error.invalidParams"))
      return
    }
    setSaving(true)
    setSaved(false)
    try {
      await api.updateMe({ nickname: nickname.trim() })
      toast.success(t("settings.saved"))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
          <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
        </div>
        <LangSwitcher />
      </header>

      <div className="space-y-8 max-w-2xl">
        {/* Profile card */}
        <div className="glass p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-400" />
            {t("settings.profile")}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("login.emailLabel")}</label>
              <input
                type="text"
                value={user?.email || ""}
                disabled
                className="input-field opacity-50 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("settings.nickname")}</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t("settings.nickname")}
                  className="input-field flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
                />
                <button
                  onClick={handleSaveNickname}
                  disabled={saving || !nickname.trim()}
                  className="btn-primary"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1.5" />
                  )}
                  {saving ? "" : t("settings.save")}
                </button>
              </div>
              {saved && (
                <p className="text-green-400 text-xs mt-1 animate-fade-in">{t("settings.saved")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Account stats */}
        <div className="glass p-6">
          <h3 className="font-semibold mb-4">{t("settings.stats")}</h3>
          {statsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-40" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">{t("settings.registeredAt")}</span>
                <span>{user?.created_at ? formatDate(user.created_at) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t("settings.totalTokens")}</span>
                <span className="font-mono tabular-nums">
                  {stats?.total_tokens?.toLocaleString() ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t("settings.totalCost")}</span>
                <span className="font-mono tabular-nums">
                  ¥{((stats?.total_cost ?? 0) / 100).toFixed(4)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Language preference */}
        <div className="glass p-6">
          <h3 className="font-semibold mb-4">{t("settings.language")}</h3>
          <div className="flex gap-2 p-1 bg-surface-800/50 rounded-xl w-fit">
            {(["zh", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  lang === l
                    ? "bg-brand-600 text-white shadow"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                {l === "zh" ? "中文" : "English"}
              </button>
            ))}
          </div>
        </div>

        {/* Password change */}
        <PasswordSection t={t} />
      </div>
    </>
  )
}

function PasswordSection({ t }: { t: any }) {
  const [oldPw, setOldPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [saving, setSaving] = useState(false)

  const handleChange = async () => {
    if (newPw !== confirmPw) { toast.error(t("login.toast.passwordMismatch")); return }
    if (newPw.length < 6) { toast.error(t("login.toast.passwordTooShort")); return }
    setSaving(true)
    try {
      await api.changePassword(oldPw, newPw)
      toast.success("密码已修改")
      setOldPw(""); setNewPw(""); setConfirmPw("")
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="glass p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Lock className="w-4 h-4 text-gray-500" />
        {t("settings.password")}
      </h3>
      <div className="space-y-4 max-w-sm">
        <div>
          <label className="block text-xs text-gray-400 mb-1">当前密码</label>
          <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} className="input-field w-full" placeholder="输入当前密码" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">新密码</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="input-field w-full" placeholder="至少6位" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">确认新密码</label>
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="input-field w-full" placeholder="再次输入新密码" />
        </div>
        <button onClick={handleChange} disabled={saving || !oldPw || !newPw} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "修改密码"}
        </button>
      </div>
    </div>
  )
}
