"use client"

import { Toaster } from "sonner"
import { I18nProvider, useI18n } from "@/lib/i18n"
import "./globals.css"

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n()
  return (
    <html lang={lang}>
      <body className="min-h-screen bg-surface-50 text-surface-950 antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "rgb(255, 255, 255)",
              color: "rgb(51, 51, 51)",
              border: "1px solid rgb(230, 230, 230)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
              borderRadius: "12px",
            },
          }}
        />
      </body>
    </html>
  )
}

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <LayoutContent>{children}</LayoutContent>
    </I18nProvider>
  )
}
