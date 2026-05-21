"use client"

import { type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldAlert } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  if (!user) {
    router.push("/login?redirect=/admin")
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm">需要管理员权限才能访问此页面</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
