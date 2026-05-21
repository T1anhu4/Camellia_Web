"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, LogOut, Settings, Shield } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "@/components/ui/lang-switcher"
import { cn } from "@/lib/utils"

export function NavBar() {
  const { t, lang } = useI18n()
  const { user, logout } = useAuth()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setDropdownOpen(true)
  }
  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setDropdownOpen(false), 200)
  }
  useEffect(() => {
    return () => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current) }
  }, [])

  const balanceYuan = ((user?.balance_cents || 0) / 100).toFixed(2)
  const tokenUsed = (user?.daily_token_used || 0).toLocaleString()
  const tokenQuota = (user?.daily_token_quota || 10000).toLocaleString()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-200">
      <div className="max-w-[1440px] mx-auto px-[16px] md:px-[28px] xl:px-[60px] 2xl:px-[107px] flex items-center justify-between h-[64px] md:h-[72px]">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-xl shrink-0">
          <div className="w-8 h-8 rounded-lg bg-surface-950 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/></svg>
          </div>
          {lang === "zh" ? <span>山茶花 <span className="text-surface-600 font-normal">Camellia</span></span> : "Camellia"}
        </Link>

        <div className="hidden md:flex items-center gap-5 text-sm text-surface-700">
          <Link href="/models" className="hover:text-surface-950 transition-colors font-medium">{lang === "zh" ? "模型" : "Models"}</Link>
          <Link href="/docs" className="hover:text-surface-950 transition-colors font-medium">{lang === "zh" ? "文档" : "Docs"}</Link>
          {user && <Link href="/dashboard" className="hover:text-surface-950 transition-colors font-medium">{t("nav.dashboard")}</Link>}
          <LangSwitcher />

          {user ? (
            <div ref={dropdownRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <button className="flex items-center gap-2 hover:bg-surface-100 rounded-lg pl-2 pr-1 py-1 transition-colors cursor-default">
                <div className="w-8 h-8 rounded-full bg-surface-950 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {(user.nickname || user.email || "U")[0]}
                </div>
                <span className="font-medium text-surface-800 max-w-[80px] truncate">{user.nickname || user.username || (user.email || "").split("@")[0]}</span>
                <ChevronDown className={cn("w-4 h-4 text-surface-500 transition-transform duration-200", dropdownOpen && "rotate-180")} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-surface-200 rounded-[16px] shadow-lg p-4 space-y-3"
                  onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                  <div className="flex items-center gap-3 pb-3 border-b border-surface-100">
                    <div className="w-10 h-10 rounded-full bg-surface-950 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(user.nickname || user.email || "U")[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-surface-900 truncate">{user.nickname || user.username || (user.email || "").split("@")[0]}</div>
                      <div className="text-xs text-surface-600 truncate">{user.email}</div>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between items-center px-2 py-1">
                      <span className="text-surface-700">{lang === "zh" ? "Token 余量" : "Token Quota"}</span>
                      <span className="font-mono font-bold text-sm text-surface-900">{tokenUsed} / {tokenQuota}</span>
                    </div>
                    <div className="flex justify-between items-center px-2 py-1">
                      <span className="text-surface-700">{lang === "zh" ? "钱包余额" : "Balance"}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-surface-900">¥{balanceYuan}</span>
                        <button onClick={() => { setDropdownOpen(false); router.push("/dashboard/billing") }}
                          className="text-xs bg-surface-950 text-white px-2 py-0.5 rounded-md hover:bg-surface-800 transition-colors">
                          + {lang === "zh" ? "充值" : "Topup"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-surface-100 pt-2 space-y-1">
                    <button onClick={() => { setDropdownOpen(false); router.push("/dashboard/settings") }}
                      className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-surface-700 hover:bg-surface-50 transition-colors">
                      <Settings className="w-4 h-4" />{lang === "zh" ? "个人资料" : "Profile"}
                    </button>
                    {user.role === "admin" && (
                      <button onClick={() => { setDropdownOpen(false); router.push("/admin") }}
                        className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-surface-700 hover:bg-surface-50 transition-colors">
                        <Shield className="w-4 h-4" />{lang === "zh" ? "管理后台" : "Admin"}
                      </button>
                    )}
                    <button onClick={() => { logout(); setDropdownOpen(false) }}
                      className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" />{lang === "zh" ? "退出登录" : "Sign Out"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => router.push("/login")} className="px-[20px] h-[40px] rounded-[12px] bg-white border border-surface-200 text-surface-900 font-bold text-sm hover:bg-surface-100 transition-colors">{t("nav.signIn")}</button>
              <button onClick={() => router.push("/login")} className="btn-primary h-[40px] text-sm">{t("nav.getStarted")}</button>
            </>
          )}
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <LangSwitcher />
          {user ? (
            <div ref={dropdownRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <button className="w-8 h-8 rounded-full bg-surface-950 flex items-center justify-center text-white text-sm font-bold">{(user.nickname || user.email || "U")[0]}</button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-surface-200 rounded-[16px] shadow-lg p-4 space-y-2"
                  onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                  <div className="font-bold text-sm text-surface-900 pb-2 border-b border-surface-100 truncate">{user.nickname || (user.email || "").split("@")[0]}</div>
                  <div className="text-xs text-surface-600 truncate">{user.email}</div>
                  <div className="text-sm flex justify-between"><span className="text-surface-700">{lang === "zh" ? "余额" : "Balance"}</span><span className="font-bold text-surface-900">¥{balanceYuan}</span></div>
                  <button onClick={() => { logout(); setDropdownOpen(false) }}
                    className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4" />{lang === "zh" ? "退出登录" : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => router.push("/login")} className="btn-primary h-[36px] text-xs px-4">{t("nav.signIn")}</button>
          )}
        </div>
      </div>
    </nav>
  )
}
