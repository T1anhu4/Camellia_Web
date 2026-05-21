"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  email: string
  username?: string | null
  nickname: string | null
  role: string
  tier: string
  balance_cents?: number
  daily_token_used?: number
  daily_token_quota?: number
  created_at?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.push("/login")
    router.refresh()
  }, [router])

  return { user, loading, logout, isAdmin: user?.role === "admin" }
}
