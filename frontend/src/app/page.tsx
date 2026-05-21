"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight, Sparkles, Menu, X, Zap, Shield, Layers,
  BarChart3, Key, Globe, ChevronRight, Code
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "@/components/ui/lang-switcher"
import { HeroParticles } from "@/components/landing/hero-particles"
import { ModelPoolShowcase } from "@/components/landing/model-pool-showcase"

export default function LandingPage() {
  const { t, lang } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <main className="relative overflow-hidden min-h-screen">
      <HeroParticles />
      <NavBar lang={lang} onMenuToggle={() => setMenuOpen(!menuOpen)} onLogin={() => setLoginOpen(true)} />
      <AnimatePresence>{menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} onLogin={() => { setMenuOpen(false); setLoginOpen(true) }} />}</AnimatePresence>
      <AnimatePresence>{loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}</AnimatePresence>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-20 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-sm mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            {lang === "zh" ? "Camellia 山茶花 · 大模型 API 调度平台" : "Camellia · Enterprise LLM Orchestration"}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.15] mb-6"
        >
          {lang === "zh" ? (
            <>一朵山茶花，<span className="gradient-text">连接无限模型</span></>
          ) : (
            <>One Camellia, <span className="gradient-text">Infinite Models</span></>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25 }}
          className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {lang === "zh"
            ? "告别多账户、多 Key、多协议的管理噩梦。一个账户，一个 API，接入所有主流大模型。兼容 OpenAI 协议，5 分钟上线。"
            : "Stop juggling accounts, keys, and protocols. One account, one API, access to all leading AI models. Fully OpenAI compatible. Go live in 5 minutes."}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button onClick={() => setLoginOpen(true)} className="btn-primary px-10 py-4 text-lg rounded-2xl font-semibold shadow-lg shadow-pink-500/25">
            {lang === "zh" ? "免费开始使用" : "Start Free"}
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
          <button onClick={() => document.getElementById("models")?.scrollIntoView({ behavior: "smooth" })}
            className="btn-secondary px-10 py-4 text-lg rounded-2xl font-semibold">
            {lang === "zh" ? "查看模型池" : "View Models"}
            <ChevronRight className="ml-2 w-5 h-5" />
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-20 pt-10 border-t border-white/5"
        >
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-center">
            {[
              { v: "OpenAI Compatible", l: lang === "zh" ? "协议兼容" : "Protocol" },
              { v: "SSE Streaming", l: lang === "zh" ? "流式转发" : "Streaming" },
              { v: "<5ms Routing", l: lang === "zh" ? "路由延迟" : "Latency" },
              { v: "Multi-Provider", l: lang === "zh" ? "多厂商支持" : "Multi-Provider" },
            ].map(s => (
              <div key={s.l}>
                <div className="text-2xl font-bold text-gray-200">{s.v}</div>
                <div className="text-xs text-gray-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Why Camellia */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {lang === "zh" ? "为什么选择 Camellia？" : "Why Camellia?"}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {lang === "zh"
              ? "一个账户，统一接入。不用再管理分散的 Key 和协议。"
              : "One account, unified access. No more managing scattered keys and protocols."}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { n: "01", i: Layers, t: lang === "zh" ? "渠道池管理" : "Channel Pool", d: lang === "zh" ? "多供应商 Key 统一纳管，优先级+权重+最少连接三级智能调度，故障自动切换" : "Multi-provider key management with 3-tier routing: priority + weight + least-connections" },
            { n: "02", i: Shield, t: lang === "zh" ? "智能熔断保护" : "Smart Failover", d: lang === "zh" ? "三态熔断器自动检测 401/429/5xx，按错误码差异化冷却，永不停服" : "3-state circuit breaker. Auto-detect failures, differential cooldown, zero downtime" },
            { n: "03", i: Zap, t: lang === "zh" ? "极低延迟" : "Ultra-Low Latency", d: lang === "zh" ? "Go Fiber 高性能网关，<5ms 路由开销，零缓冲 SSE 流式转发" : "Go Fiber gateway, <5ms routing overhead, zero-buffer SSE streaming" },
            { n: "04", i: BarChart3, t: lang === "zh" ? "实时用量分析" : "Usage Analytics", d: lang === "zh" ? "Token 消耗、费用趋势、并发监控，7天/30天可切换图表" : "Token tracking, cost trends, concurrency monitoring. 7d/30d charts" },
            { n: "05", i: Key, t: lang === "zh" ? "API Key 管理" : "API Key Mgmt", d: lang === "zh" ? "SHA-256 哈希存储，创建后仅展示一次，Redis 热缓存亚毫秒鉴权" : "SHA-256 hashed, show-once, Redis hot-cache sub-ms auth" },
            { n: "06", i: Code, t: lang === "zh" ? "OpenAI 兼容" : "OpenAI Compatible", d: lang === "zh" ? "一行 base_url 切换，支持 Chat / Embeddings / Models 全部端点" : "One-line base_url switch. All Chat / Embeddings / Models endpoints" },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="glass-hover p-6 rounded-2xl group relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 text-4xl font-bold text-white/5 group-hover:text-pink-500/20 transition-colors">{f.n}</div>
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center mb-4 relative z-10">
                <f.i className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="font-semibold mb-2 relative z-10">{f.t}</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Model Pool */}
      <section id="models" className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">{lang === "zh" ? "Token 模型池" : "Model Pool"}</h2>
          <p className="text-gray-400">{lang === "zh" ? "实时展示可用模型，添加渠道即刻上线" : "Real-time model availability. Add channels to go live instantly."}</p>
        </div>
        <ModelPoolShowcase />
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="glass p-12 md:p-16 rounded-3xl text-center bg-gradient-to-br from-pink-500/5 to-transparent border border-pink-500/10"
        >
          <h2 className="text-3xl font-bold mb-3">{lang === "zh" ? "准备好开始了吗？" : "Ready to start?"}</h2>
          <p className="text-gray-400 mb-8 text-lg">{lang === "zh" ? "2 分钟获取 API Key，无需信用卡" : "Get API keys in 2 minutes. No credit card required."}</p>
          <button onClick={() => setLoginOpen(true)} className="btn-primary px-10 py-4 text-lg rounded-2xl font-semibold shadow-lg shadow-pink-500/25">
            {lang === "zh" ? "免费注册" : "Create Free Account"}
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Camellia</span>
          </div>
          <div className="flex gap-6">
            <a href="#models" className="hover:text-gray-400 transition-colors">{lang === "zh" ? "模型池" : "Models"}</a>
            <a href="#" className="hover:text-gray-400 transition-colors">{lang === "zh" ? "API 文档" : "API Docs"}</a>
            <Link href="/login" className="hover:text-gray-400 transition-colors">{lang === "zh" ? "登录" : "Sign In"}</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Camellia. {lang === "zh" ? "为开发者而生。" : "Built for builders."}</p>
        </div>
      </footer>
    </main>
  )
}

// ─── Nav ───
function NavBar({ lang, onMenuToggle, onLogin }: { lang: string; onMenuToggle: () => void; onLogin: () => void }) {
  return (
    <nav className="relative z-20 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30 group-hover:scale-105 transition-transform">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">
          {lang === "zh" ? (
            <>山茶花<span className="text-pink-400">Camellia</span></>
          ) : (
            <span className="text-pink-400">Camellia</span>
          )}
        </span>
      </Link>
      <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
        <a href="#models" className="hover:text-white transition-colors">{lang === "zh" ? "模型" : "Models"}</a>
        <a href="#" className="hover:text-white transition-colors">{lang === "zh" ? "定价" : "Pricing"}</a>
        <a href="#" className="hover:text-white transition-colors">{lang === "zh" ? "文档" : "Docs"}</a>
        <LangSwitcher />
        <button onClick={onLogin} className="btn-secondary text-sm px-4 py-2 rounded-xl">{lang === "zh" ? "登录" : "Sign In"}</button>
        <button onClick={onLogin} className="btn-primary text-sm px-4 py-2 rounded-xl">{lang === "zh" ? "免费开始" : "Start Free"}</button>
      </div>
      <div className="flex md:hidden items-center gap-2">
        <LangSwitcher />
        <button onClick={onLogin} className="btn-secondary text-xs px-3 py-1.5 rounded-xl">{lang === "zh" ? "登录" : "Sign In"}</button>
        <button onClick={onMenuToggle} className="p-2 rounded-xl hover:bg-white/5 text-gray-400"><Menu className="w-5 h-5" /></button>
      </div>
    </nav>
  )
}

// ─── Mobile Menu ───
function MobileMenu({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }}
        className="absolute top-0 right-0 h-full w-72 bg-surface-900 border-l border-white/10 p-6 flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-8">
          <span className="font-bold text-lg">Camellia</span>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5"><X className="w-5 h-5" /></button>
        </div>
        <nav className="space-y-1 flex-1">
          {["模型","定价","文档","API 参考"].map(item => (
            <a key={item} href="#" onClick={onClose} className="block px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">{item}</a>
          ))}
        </nav>
        <button onClick={onLogin} className="btn-primary w-full rounded-xl">免费开始使用</button>
      </motion.div>
    </motion.div>
  )
}

// ─── Login Modal ───
function LoginModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [tab, setTab] = useState<"login" | "register">("login")
  const [loginVal, setLoginVal] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [regPw, setRegPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [code, setCodeVal] = useState("")
  const [needVerify, setNeedVerify] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const { user } = await api.login(loginVal, password)
      toast.success("Welcome" + (user?.nickname ? `, ${user.nickname}` : "!"))
      onClose(); router.push(user?.role === "admin" ? "/admin" : "/dashboard"); router.refresh()
    } catch (err: any) { toast.error(err.message || "Login failed") }
    finally { setLoading(false) }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (regPw !== confirmPw) { toast.error("Passwords do not match"); return }
    if (regPw.length < 6) { toast.error("Password too short"); return }
    setLoading(true)
    try { await api.registerStart(email, username, regPw); setNeedVerify(true); toast.success("Verification code sent") }
    catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try { await api.registerVerify(email, username, regPw, code); toast.success("Welcome!"); onClose(); router.push("/dashboard"); router.refresh() }
    catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass p-8 w-full max-w-md rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-pink-400" /><span className="font-bold">Camellia</span></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex mb-6 bg-surface-800 rounded-xl p-1">
          <button onClick={() => { setTab("login"); setNeedVerify(false); setCodeVal("") }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "login" ? "bg-pink-500 text-white" : "text-gray-400 hover:text-gray-200"}`}>
            Sign In
          </button>
          <button onClick={() => { setTab("register"); setNeedVerify(false); setCodeVal("") }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "register" ? "bg-pink-500 text-white" : "text-gray-400 hover:text-gray-200"}`}>
            Register
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input value={loginVal} onChange={e => setLoginVal(e.target.value)} placeholder="Email / Username" className="input-field w-full" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="input-field w-full" required />
            <button type="submit" disabled={loading} className="btn-primary w-full rounded-xl">{loading ? "..." : "Sign In"}</button>
          </form>
        ) : !needVerify ? (
          <form onSubmit={handleSendCode} className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="input-field w-full" required />
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username (3-30 chars)" className="input-field w-full" required />
            <input type="password" value={regPw} onChange={e => setRegPw(e.target.value)} placeholder="Password (6+ chars)" className="input-field w-full" required />
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm Password" className="input-field w-full" required />
            <button type="submit" disabled={loading} className="btn-primary w-full rounded-xl">Send Verification Code</button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-gray-400 text-center">Code sent to {email}</p>
            <input type="text" maxLength={6} value={code} onChange={e => setCodeVal(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="input-field w-full text-center text-2xl tracking-[0.5em] font-mono" required autoFocus />
            <button type="submit" disabled={loading} className="btn-primary w-full rounded-xl">Verify & Sign Up</button>
            <button type="button" onClick={() => { setNeedVerify(false); setCodeVal("") }} className="w-full text-sm text-gray-500 hover:text-gray-300 py-2">Change email</button>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
