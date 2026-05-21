"use client"

import { createContext, useContext, type ReactNode } from "react"

interface DashboardCtxType {
  user: any
  logout: () => void
}

const DashboardCtx = createContext<DashboardCtxType>({ user: null, logout: () => {} })

export function DashboardProvider({ children, value }: { children: ReactNode; value: DashboardCtxType }) {
  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>
}

export function useDashboard() {
  return useContext(DashboardCtx)
}
