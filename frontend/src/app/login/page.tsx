"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Code2, Mail, Lock, User, Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "@/components/ui/lang-switcher"

export default function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [tab, setTab] = useState<"login" | "register">("login")

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-surface-950">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-brand-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-4 right-4"><LangSwitcher /></div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">Camellia</span>
        </Link>

        <div className="glass p-8">
          {/* Tabs */}
          <div className="flex mb-6 bg-surface-800 rounded-lg p-1">
            <button onClick={() => setTab("login")} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${tab === "login" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>{t("login.tabLogin")}</button>
            <button onClick={() => setTab("register")} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${tab === "register" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>{t("login.tabRegister")}</button>
          </div>

          {tab === "login" ? <LoginForm t={t} router={router} /> : <RegisterForm t={t} router={router} setTab={setTab} />}
        </div>

        <Link href="/" className="block text-center text-xs text-gray-500 hover:text-gray-300 mt-4 transition-colors">{t("common.back")}</Link>
      </motion.div>
    </div>
  )
}

function LoginForm({ t, router }: { t: any; router: any }) {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!login || !password) return
    setLoading(true)
    try {
      const { user } = await api.login(login, password)
      toast.success(t("login.toast.welcome") + (user?.nickname ? `, ${user.nickname}` : "!"))
      router.push(user?.role === "admin" ? "/admin" : "/dashboard")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || t("login.toast.loginFailed"))
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t("login.emailLabel")} / {t("login.usernameLabel")}</label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="email@example.com" className="input-field pl-10" required autoFocus autoComplete="username" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t("login.passwordLabel")}</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("login.passwordPlaceholder")} className="input-field pl-10 pr-10" required autoComplete="current-password" />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t("login.loginButton")} <ArrowRight className="ml-2 w-4 h-4" /></>}
      </button>
    </form>
  )
}

function RegisterForm({ t, router, setTab }: { t: any; router: any; setTab: (v: "login") => void }) {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [code, setCode] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [needVerify, setNeedVerify] = useState(false)

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPw) { toast.error(t("login.toast.passwordMismatch")); return }
    if (password.length < 6) { toast.error(t("login.toast.passwordTooShort")); return }
    if (username.length < 3 || username.length > 30) { toast.error(t("login.toast.usernameInvalid")); return }
    setLoading(true)
    try {
      await api.registerStart(email, username, password)
      setNeedVerify(true)
      toast.success(t("login.toast.codeSent"))
    } catch (err: any) {
      toast.error(err.message || t("login.toast.sendFailed"))
    } finally { setLoading(false) }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) { toast.error(t("login.toast.invalidCode")); return }
    setLoading(true)
    try {
      const { user } = await api.registerVerify(email, username, password, code)
      toast.success(t("login.toast.registerSuccess") + (user?.nickname ? `, ${user.nickname}` : "!"))
      router.push("/dashboard")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || t("login.toast.invalidCodeError"))
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={needVerify ? handleVerify : handleSendCode} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t("login.emailLabel")}</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="input-field pl-10" required autoComplete="email" disabled={needVerify} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t("login.usernameLabel")}</label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("login.usernamePlaceholder")} className="input-field pl-10" required autoComplete="username" disabled={needVerify} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t("login.passwordLabel")}</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("login.passwordPlaceholder")} className="input-field pl-10 pr-10" required autoComplete="new-password" disabled={needVerify} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t("login.confirmPasswordLabel")}</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder={t("login.passwordPlaceholder")} className="input-field pl-10" required autoComplete="new-password" disabled={needVerify} />
        </div>
      </div>

      {/* Verification code step */}
      {needVerify && (
        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">{t("login.codeLabel")}</label>
          <input type="text" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder={t("login.codePlaceholder")} className="input-field text-center text-2xl tracking-[0.5em] font-mono" required autoFocus autoComplete="one-time-code" />
          <p className="text-xs text-gray-500 mt-1">{t("login.codeSent", { email })}</p>
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : needVerify ? <>{t("login.verifySignIn")} <ArrowRight className="ml-2 w-4 h-4" /></> : <>{t("login.sendCode")} <ArrowRight className="ml-2 w-4 h-4" /></>}
      </button>

      {needVerify && (
        <button type="button" onClick={() => { setNeedVerify(false); setCode("") }} className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors py-2">
          {t("login.differentEmail")}
        </button>
      )}

      <p className="text-center text-xs text-gray-500">
        {t("login.terms")} {" "}
        <button type="button" onClick={() => setTab("login")} className="text-brand-400 hover:underline">{t("login.tabLogin")}</button>
      </p>
    </form>
  )
}
