"use client"

import { useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { BarChart3, CreditCard, Key, LogOut, Menu, Settings, X, Zap, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { DashboardProvider } from "@/hooks/use-dashboard"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  if (!user) {
    router.push("/login")
    return null
  }

  return (
    <DashboardProvider value={{ user, logout }}><div className="min-h-screen bg-surface-950">
        {/* Mobile nav */}
        <nav className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-surface-900/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-400" />
            <span className="font-bold text-sm">Camellia</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-white/10">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-30">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <div className="absolute top-0 left-0 bottom-0 w-64 bg-surface-900 border-r border-white/5 p-6 flex flex-col">
              <SidebarContent user={user} onLogout={logout} onNav={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="fixed top-0 left-0 h-full w-64 bg-surface-900/80 border-r border-white/5 p-6 hidden lg:flex flex-col">
          <SidebarContent user={user} onLogout={logout} />
        </aside>

        <main className="ml-0 lg:ml-64 p-6 lg:p-10 pt-20 lg:pt-10">
          {children}
        </main>
      </div>
    </DashboardProvider>
  )
}

function SidebarContent({
  user,
  onLogout,
  onNav,
}: {
  user: any
  onLogout: () => void
  onNav?: () => void
}) {
  const { t } = useI18n()
  const pathname = usePathname()

  const links = [
    { href: "/dashboard", icon: BarChart3, label: t("nav.dashboard") },
    { href: "/dashboard/keys", icon: Key, label: t("nav.keys") },
    { href: "/dashboard/billing", icon: CreditCard, label: t("nav.billing") },
    { href: "/dashboard/settings", icon: Settings, label: t("nav.settings") },
  ]

  return (
    <>
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-sm">Camellia</span>
      </div>

      <nav className="space-y-1 flex-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNav}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all",
              pathname === link.href
                ? "bg-brand-500/10 text-brand-400 font-medium"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            )}
          >
            <link.icon className="w-4 h-4" />
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-4">
        <div className="glass p-4 text-xs">
          <div className="text-gray-400 mb-1">{t("nav.currentPlan")}</div>
          <div className="font-semibold text-brand-400 capitalize">
            {user?.tier || "free"}
          </div>
          <div className="text-gray-500 mt-1">
            {t("dashboard.plan.tokens", { n: "10K" })}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all"
        >
          <LogOut className="w-4 h-4" />
          {t("nav.signOut")}
        </button>
      </div>
    </>
  )
}
