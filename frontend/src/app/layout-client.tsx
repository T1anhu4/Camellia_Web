"use client"

import { Toaster } from "sonner"
import { I18nProvider, useI18n } from "@/lib/i18n"
import "./globals.css"

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n()
  return (
    <html lang={lang} className="dark">
      <body className="min-h-screen">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "rgb(30, 41, 59)",
              color: "rgb(226, 232, 240)",
              border: "1px solid rgb(51, 65, 85)",
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
