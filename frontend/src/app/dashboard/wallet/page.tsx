"use client"

import { Wallet, CreditCard } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { useAuth } from "@/hooks/use-auth"
import { formatCents, formatTokens } from "@/lib/utils"

const packages = [
  { id: "5m", tokens: 5000000, price: 29, descZh: "适合个人开发者", descEn: "For individuals" },
  { id: "10m", tokens: 10000000, price: 49, descZh: "适合小团队", descEn: "For small teams" },
  { id: "50m", tokens: 50000000, price: 199, descZh: "适合创业公司", descEn: "For startups" },
  { id: "100m", tokens: 100000000, price: 349, descZh: "适合企业用户", descEn: "For enterprises" },
]

export default function WalletPage() {
  const { t, lang } = useI18n()
  const { user } = useAuth()

  return (
    <>
      <header className="mb-8">
        <h1 className="text-[28px] md:text-[36px] font-bold">{t("nav.wallet")}</h1>
        <p className="text-surface-600 text-sm mt-1">{lang === "zh" ? "账户余额与套餐购买" : "Balance & Packages"}</p>
      </header>

      <div className="space-y-6">
        {/* Balance */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card bg-surface-50 p-6">
            <div className="flex items-center gap-3 mb-3"><Wallet className="w-5 h-5 text-surface-500" /><span className="text-sm text-surface-500">{lang === "zh" ? "账户余额" : "Balance"}</span></div>
            <div className="text-[36px] font-bold">{formatCents(user?.balance_cents || 0)}</div>
          </div>
          <div className="card bg-surface-50 p-6">
            <div className="flex items-center gap-3 mb-3"><CreditCard className="w-5 h-5 text-surface-500" /><span className="text-sm text-surface-500">{lang === "zh" ? "今日已用" : "Used Today"}</span></div>
            <div className="text-[36px] font-bold">{formatTokens(user?.daily_token_used || 0)}</div>
          </div>
        </div>

        {/* Token Packages */}
        <div className="card bg-white p-6">
          <h3 className="font-bold text-lg mb-4">{lang === "zh" ? "Token 套餐" : "Token Packages"}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map(pkg => (
              <div key={pkg.id} className="card bg-surface-50 p-5 text-center hover:ring-2 hover:ring-surface-950 transition-all cursor-pointer">
                <div className="text-2xl font-bold mb-1">{formatTokens(pkg.tokens)}</div>
                <div className="text-xl font-bold text-surface-950 mb-2">¥{pkg.price}</div>
                <div className="text-xs text-surface-500 mb-3">{lang === "zh" ? pkg.descZh : pkg.descEn}</div>
                <div className="text-xs text-surface-400">¥{(pkg.price / (pkg.tokens / 1000)).toFixed(4)}/1K tokens</div>
                <button className="btn-primary w-full mt-4 text-sm h-10">{lang === "zh" ? "立即购买" : "Buy Now"}</button>
              </div>
            ))}
          </div>
        </div>

        {/* Alipay placeholder */}
        <div className="card bg-white p-8 text-center">
          <h3 className="font-bold mb-4">{lang === "zh" ? "支付宝扫码支付" : "Alipay QR Pay"}</h3>
          <div className="w-40 h-40 mx-auto bg-surface-100 rounded-2xl flex items-center justify-center">
            <CreditCard className="w-10 h-10 text-surface-300" />
          </div>
          <p className="text-sm text-surface-500 mt-4">{lang === "zh" ? "请联系客服获取支付二维码" : "Contact support for payment QR code"}</p>
        </div>
      </div>
    </>
  )
}
