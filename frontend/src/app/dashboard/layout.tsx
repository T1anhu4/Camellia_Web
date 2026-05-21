"use client"

import { useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { BarChart3, CreditCard, Key, LogOut, Menu, Settings, X, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { DashboardProvider } from "@/hooks/use-dashboard"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { NavBar } from "@/components/layout/nav-bar"

const NAV_H = "h-[64px] md:h-[72px]"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-surface-400 animate-spin" />
      </div>
    )
  }

  if (!user) {
    router.push("/login")
    return null
  }

  return (
    <DashboardProvider value={{ user, logout }}>
      <div className="min-h-screen bg-surface-50">
        <NavBar />

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-30">
            <div className="absolute inset-0 bg-surface-950/20" onClick={() => setMobileOpen(false)} />
            <div className={`absolute top-[64px] left-0 bottom-0 w-64 bg-white border-r border-surface-200 p-6 flex flex-col shadow-lg`}>
              <SidebarContent user={user} onLogout={logout} onNav={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Desktop sidebar — sits below NavBar */}
        <aside className={`fixed top-[64px] md:top-[72px] left-0 bottom-0 w-64 bg-white border-r border-surface-200 p-6 hidden lg:flex flex-col overflow-y-auto`}>
          <SidebarContent user={user} onLogout={logout} />
        </aside>

        {/* Main — starts below NavBar, offset by sidebar */}
        <main className="pt-[64px] md:pt-[72px] lg:ml-64">
          <div className="p-6 lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </DashboardProvider>
  )
}

function SidebarContent({ user, onLogout, onNav }: { user: any; onLogout: () => void; onNav?: () => void }) {
  const { t } = useI18n()
  const pathname = usePathname()

  const links = [
    { href: "/dashboard", icon: BarChart3, label: t("nav.dashboard") },
    { href: "/dashboard/keys", icon: Key, label: t("nav.keys") },
    { href: "/dashboard/wallet", icon: CreditCard, label: t("nav.wallet") },
    { href: "/dashboard/billing", icon: BarChart3, label: t("nav.billing") },
    { href: "/dashboard/settings", icon: Settings, label: t("nav.settings") },
  ]

  if (user?.role === "admin") {
    links.push({ href: "/admin", icon: Settings, label: t("admin.title") })
  }

  return (
    <>
      <nav className="space-y-1 flex-1">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNav}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
              pathname === link.href
                ? "bg-surface-950 text-white font-medium"
                : "text-surface-700 hover:text-surface-950 hover:bg-surface-100"
            )}
          >
            <link.icon className="w-4 h-4" />
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-3 pt-4 border-t border-surface-200 mt-auto">
        <div className="px-3 py-2 rounded-lg bg-surface-50 text-xs">
          <div className="text-surface-600 mb-0.5">{t("nav.currentPlan")}</div>
          <div className="font-bold text-surface-950 capitalize">{user?.tier || "free"}</div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-surface-600 hover:text-surface-950 hover:bg-surface-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t("nav.signOut")}
        </button>
      </div>
    </>
  )
}
