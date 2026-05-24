"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { BarChart3, CreditCard, Database, Layers, Network, Plus, Search, Settings, Trash2, Users, X, RefreshCw, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { cn, formatTokens, formatCents, formatDate } from "@/lib/utils"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { NavBar } from "@/components/layout/nav-bar"
import { Skeleton, CardSkeleton, TableSkeleton } from "@/components/ui/skeleton"

type AdminTab = "overview" | "users" | "channels" | "pricing" | "billing"

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview")
  const { t } = useI18n()

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-surface-50 flex pt-[64px] md:pt-[72px]">
      <AdminSidebar tab={tab} onTabChange={setTab} />
      <main className="flex-1 p-6 lg:p-10 pt-[72px] lg:pt-10 ml-0 lg:ml-64">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold">{t("admin.title")}</h1>
        </header>
        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "channels" && <ChannelsTab />}
        {tab === "pricing" && <PricingTab />}
        {tab === "billing" && <BillingTab />}
      </main>
    </div>
  </>
  )
}

function AdminSidebar({ tab, onTabChange }: { tab: AdminTab; onTabChange: (t: AdminTab) => void }) {
  const { t } = useI18n()
  const items: { id: AdminTab; icon: any; label: string }[] = [
    { id: "overview", icon: BarChart3, label: t("admin.sidebar.overview") },
    { id: "users", icon: Users, label: t("admin.sidebar.users") },
    { id: "channels", icon: Network, label: t("admin.sidebar.channels") },
    { id: "pricing", icon: Database, label: t("admin.sidebar.pricing") },
    { id: "billing", icon: CreditCard, label: t("admin.sidebar.billing") },
  ]

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-white border-r border-surface-200 p-6 z-10 hidden lg:flex flex-col">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-surface-950 flex items-center justify-center"><span className="text-white font-bold text-xs">A</span></div>
        <span className="font-bold text-sm">{t("admin.sidebar.title")}</span>
      </div>
      <nav className="space-y-1">
        {items.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => onTabChange(id)}
            className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
              tab === id ? "bg-surface-950 text-white font-medium" : "text-surface-600 hover:text-surface-950 hover:bg-surface-100")}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

function OverviewTab() {
  const { t } = useI18n()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { setStats(await api.getAdminStats()) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])

  const cards = [
    { label: t("admin.overview.totalUsers"), value: stats?.total_users ?? 0 },
    { label: t("admin.overview.activeChannels"), value: stats?.active_channels ?? 0 },
    { label: t("admin.overview.todayRevenue"), value: formatCents(stats?.today_revenue_cents ?? 0) },
    { label: t("admin.overview.todayTokens"), value: formatTokens(stats?.today_tokens ?? 0) },
  ]

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="card bg-surface-50 p-5">
            <div className="text-sm text-surface-500 mb-1">{c.label}</div>
            <div className="text-[28px] font-bold">{loading ? <Skeleton className="w-16 h-8" /> : c.value}</div>
          </div>
        ))}
      </div>
      <div className="card bg-white p-6">
        <h3 className="font-bold mb-2">{t("admin.overview.systemStatus")}</h3>
        <p className="text-sm text-surface-600">{t("admin.overview.allOk", { n: stats?.total_requests_today ?? 0 })}</p>
      </div>
    </div>
  )
}

function UsersTab() {
  const { t } = useI18n()
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await api.getUsers(page, search); setData(res.data); setTotal(res.total) } catch {}
    finally { setLoading(false) }
  }, [page, search])
  useEffect(() => { load() }, [load])

  const saveField = async (userId: string, field: string, value: string | number) => {
    try { await api.patchUser(userId, { [field]: value }); toast.success("已更新"); load() }
    catch (err: any) { toast.error(err.message) }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input type="text" placeholder={t("admin.users.searchPlaceholder")} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="input-field pl-10" />
        </div>
        <button onClick={load} className="btn-secondary text-sm" disabled={loading}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></button>
      </div>

      <div className="card bg-white overflow-x-auto">
        {loading ? <div className="p-6"><TableSkeleton rows={8} cols={8} /></div> :
         data.length === 0 ? <div className="p-12 text-center text-surface-500">{t("admin.users.noUsers")}</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-100">
              {["邮箱","用户名","名称","角色","套餐","余额","Token配额","状态","备注","操作"].map(h => (
                <th key={h} className="text-left py-3 px-3 text-xs font-medium text-surface-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-b border-surface-50 hover:bg-surface-50">
                  <td className="py-2 px-3 text-surface-600 text-xs max-w-[150px] truncate">{r.email}</td>
                  <td className="py-2 px-3 text-surface-600 text-xs">{r.username || "-"}</td>
                  <td className="py-2 px-3">
                    <input className="bg-transparent border border-transparent hover:border-surface-300 focus:border-surface-950 rounded px-1.5 py-0.5 text-xs w-full min-w-[80px]" defaultValue={r.nickname || ""} onBlur={e => { if (e.target.value !== (r.nickname || "")) saveField(r.id, "nickname", e.target.value) }} />
                  </td>
                  <td className="py-2 px-3">
                    <select className="bg-surface-50 border border-surface-200 rounded px-1.5 py-0.5 text-xs" defaultValue={r.role} onChange={e => saveField(r.id, "role", e.target.value)}>
                      <option value="user">user</option><option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <select className="bg-surface-50 border border-surface-200 rounded px-1.5 py-0.5 text-xs" defaultValue={r.subscription_tier} onChange={e => saveField(r.id, "subscription_tier", e.target.value)}>
                      <option value="free">free</option><option value="vip">vip</option><option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input className="bg-transparent border border-transparent hover:border-surface-300 focus:border-surface-950 rounded px-1.5 py-0.5 text-xs w-[80px] font-mono" defaultValue={r.balance_cents} onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== r.balance_cents) saveField(r.id, "balance_cents", v) }} />
                  </td>
                  <td className="py-2 px-3 text-xs">
                    <input className="bg-transparent border border-transparent hover:border-surface-300 focus:border-surface-950 rounded px-1.5 py-0.5 text-xs w-[70px] font-mono" defaultValue={r.daily_token_quota} onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== r.daily_token_quota) saveField(r.id, "daily_token_quota", v) }} />
                    <span className="text-surface-400 ml-1">/ 已用{r.daily_token_used||0}</span>
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => saveField(r.id, "status", r.status === "active" ? "disabled" : "active")}
                      className={cn("px-2 py-0.5 rounded text-xs font-medium transition-colors", r.status === "active" ? "bg-emerald-50 text-emerald-600 hover:bg-red-50 hover:text-red-600" : "bg-red-50 text-red-600 hover:bg-emerald-50 hover:text-emerald-600")}>
                      {r.status === "active" ? "启用" : "禁用"}
                    </button>
                  </td>
                  <td className="py-2 px-3">
                    <input className="bg-transparent border border-transparent hover:border-surface-300 focus:border-surface-950 rounded px-1.5 py-0.5 text-xs w-full min-w-[80px] text-surface-500" defaultValue={r.remark || ""} placeholder="备注..." onBlur={e => { if (e.target.value !== (r.remark || "")) saveField(r.id, "remark", e.target.value) }} />
                  </td>
                  <td className="py-2 px-3" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ChannelsTab() {
  const { t } = useI18n()
  const [pools, setPools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPool, setSelectedPool] = useState<any>(null)
  const [poolKeys, setPoolKeys] = useState<any[]>([])
  const [showNewPool, setShowNewPool] = useState(false)
  const [showAddKey, setShowAddKey] = useState(false)
  const [newPool, setNewPool] = useState({ name: "", display_name: "", input_price: 2, output_price: 8, pricing_mode: "per_token" as "per_token"|"per_call", per_call_price: 1 })
  const [newKey, setNewKey] = useState({ api_key: "", base_url: "", key_priority: 3, key_name: "", notes: "", max_concurrency: 10, provider: "deepseek" as string, balance_token: "" })
  const [editingKey, setEditingKey] = useState<any>(null)
  const [editingPool, setEditingPool] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletePoolId, setDeletePoolId] = useState<string | null>(null)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [batchProvider, setBatchProvider] = useState("deepseek")
  const [batchBaseUrl, setBatchBaseUrl] = useState("https://api.deepseek.com")
  const [batchRows, setBatchRows] = useState("")
  const [batchImporting, setBatchImporting] = useState(false)

  const loadPools = useCallback(async () => { setLoading(true); try { setPools(await api.getModelPools()) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { loadPools() }, [loadPools])

  const loadPoolDetail = async (poolId: string) => {
    try { const d = await api.getModelPool(poolId); setSelectedPool(d.pool); setPoolKeys(d.keys); setShowAddKey(false) } catch {}
  }

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true)
    try { await api.createModelPool({ name: newPool.name.trim(), display_name: newPool.display_name || newPool.name, input_price_cents: Math.round(newPool.input_price * 100), output_price_cents: Math.round(newPool.output_price * 100), per_call_price_cents: Math.round(newPool.per_call_price * 100), pricing_mode: newPool.pricing_mode }); setShowNewPool(false); setNewPool({ name: "", display_name: "", input_price: 2, output_price: 8, pricing_mode: "per_token", per_call_price: 1 }); loadPools() }
    catch (err: any) { toast.error(err.message) } finally { setSubmitting(false) }
  }

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true)
    try {
      await api.createChannel({ name: selectedPool.name, provider: newKey.provider || "custom", api_key: newKey.api_key, base_url: newKey.base_url, models: [selectedPool.name], weight: 1, priority: 0, max_concurrency: newKey.max_concurrency, model_pool_id: selectedPool.id, key_priority: newKey.key_priority, notes: newKey.notes, key_name: selectedPool.name, balance_provider: newKey.provider, initial_balance_cents: 0, balance_cents: 0, balance_token: newKey.balance_token })
      toast.success("Key 已添加")
      // Auto-fetch balance if token provided
      if (newKey.balance_token) {
        try {
          const balance = await api.checkChannelBalance(newKey.provider, newKey.balance_token)
          if (balance?.balance_cents > 0) {
            await api.updateChannel({ id: (await api.getModelPool(selectedPool.id)).keys[0]?.id, balance_cents: balance.balance_cents, initial_balance_cents: balance.balance_cents })
          }
        } catch {}
      }
      setShowAddKey(false)
      setNewKey({ api_key: "", base_url: "", key_priority: 3, key_name: "", notes: "", max_concurrency: 10, provider: "deepseek", balance_token: "" })
      loadPoolDetail(selectedPool.id)
    } catch (err: any) { toast.error(err.message) } finally { setSubmitting(false) }
  }

  const handleDeletePool = async (id: string) => {
    try { await api.deleteModelPool(id); toast.success("模型池已删除"); setDeletePoolId(null); loadPools() }
    catch (err: any) { toast.error(err.message) }
  }

  const handleDeleteKey = async (id: string) => { if (!confirm("删除此 Key？")) return; try { await api.deleteChannel(id); toast.success("已删除"); loadPoolDetail(selectedPool.id) } catch (err: any) { toast.error(err.message) } }

  if (selectedPool) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedPool(null)} className="text-sm text-surface-600 hover:text-surface-950 flex items-center gap-1"><ChevronLeft className="w-4 h-4" />返回模型池列表</button>
        <div className="card bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="text-xl font-bold">{selectedPool.display_name || selectedPool.name}</h2><p className="text-sm text-surface-500 mt-1">模型池 · {poolKeys.length} 个 Key</p></div>
            <div className="flex gap-2">
              <span className={cn("px-2 py-1 rounded text-xs font-medium", selectedPool.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{selectedPool.is_active ? "启用" : "停用"}</span>
            </div>
          </div>

          {/* Health bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-surface-500 mb-1"><span>Key 健康度</span><span>{poolKeys.filter((k: any) => k.status === "active").length}/{poolKeys.length} 活跃</span></div>
            <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${poolKeys.length > 0 ? (poolKeys.filter((k: any) => k.status === "active").length / poolKeys.length * 100) : 0}%` }} />
            </div>
          </div>

          {/* Balance bar */}
          {(() => {
            const totalInit = poolKeys.reduce((s: number, k: any) => s + (k.initial_balance_cents || 0), 0)
            const totalBal = poolKeys.reduce((s: number, k: any) => s + (k.balance_cents || 0), 0)
            if (totalInit === 0) return null
            const pct = totalInit > 0 ? (totalBal / totalInit * 100) : 0
            return (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-surface-500 mb-1"><span>余额汇总</span><span>¥{(totalBal / 100).toFixed(2)} / ¥{(totalInit / 100).toFixed(2)}</span></div>
                <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )
          })()}

          {/* Priority legend */}
          <div className="flex gap-2 mb-4 text-xs">
            {[0,1,2,3,4,5].map(p => (
              <span key={p} className={cn("px-2 py-0.5 rounded font-medium", p <= 1 ? "bg-red-100 text-red-700" : p <= 3 ? "bg-amber-100 text-amber-700" : "bg-surface-100 text-surface-600")}>P{p} — {p === 0 ? "最高" : p === 5 ? "最低" : `级别${p}`}</span>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h3 className="font-bold">API Keys ({poolKeys.length})</h3>
          <button onClick={() => setShowAddKey(!showAddKey)} className="btn-primary text-sm"><Plus className="w-4 h-4 mr-1" />添加 Key</button>
        </div>

        {showAddKey && (
          <form onSubmit={handleAddKey} className="card bg-white p-5 space-y-3">
            <h4 className="font-bold text-sm">添加 API Key 到 {selectedPool.name}</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-surface-600 mb-0.5 block">Key 渠道</label>
                <select value={newKey.provider} onChange={e => { const p = e.target.value; const baseUrls: Record<string,string> = { deepseek: 'https://api.deepseek.com', proaiapi: 'https://proaiapi.tech', gemini: 'https://generativelanguage.googleapis.com', custom: '' }; setNewKey({ ...newKey, provider: p, base_url: baseUrls[p] || '' }) }} className="input-field">
                  <option value="deepseek">DeepSeek 官方</option>
                  <option value="gemini">Google AI Studio</option>
                  <option value="proaiapi">proaiapi</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div><label className="text-xs text-surface-600 mb-0.5 block">用户 Token（查余额用）</label><input value={newKey.balance_token} onChange={e => setNewKey({ ...newKey, balance_token: e.target.value })} placeholder={newKey.provider === 'proaiapi' ? '邮箱:密码' : 'sk-...'} className="input-field" /></div>
              <div><label className="text-xs text-surface-600 mb-0.5 block">优先级 (0最高-5最低)</label><select value={newKey.key_priority} onChange={e => setNewKey({ ...newKey, key_priority: +e.target.value })} className="input-field"><option value={0}>P0 — 最高</option><option value={1}>P1</option><option value={2}>P2</option><option value={3}>P3 — 默认</option><option value={4}>P4</option><option value={5}>P5 — 最低</option></select></div>
              <div className="sm:col-span-2"><label className="text-xs text-surface-600 mb-0.5 block">API Key *</label><input value={newKey.api_key} onChange={e => setNewKey({ ...newKey, api_key: e.target.value })} placeholder="sk-..." className="input-field" required /></div>
              <div className="sm:col-span-2"><label className="text-xs text-surface-600 mb-0.5 block">Base URL *</label><input value={newKey.base_url} onChange={e => setNewKey({ ...newKey, base_url: e.target.value })} placeholder="https://api.xxx.com" className="input-field" required /></div>
              <div><label className="text-xs text-surface-600 mb-0.5 block">最大并发</label><input value={newKey.max_concurrency} onChange={e => setNewKey({ ...newKey, max_concurrency: +e.target.value })} type="number" min={1} className="input-field" /></div>
              <div className="sm:col-span-2"><label className="text-xs text-surface-600 mb-0.5 block">备注</label><input value={newKey.notes} onChange={e => setNewKey({ ...newKey, notes: e.target.value })} placeholder="来源、用途等备注信息" className="input-field" /></div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}添加 Key</button>
          </form>
        )}

        <div className="card bg-white overflow-hidden">
          {poolKeys.length === 0 ? <div className="p-8 text-center text-surface-500 text-sm">此模型池还没有 Key，点击"添加 Key"导入</div> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-surface-200">
                <th className="text-left py-3 px-3 text-xs font-medium text-surface-500">名称</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-surface-500">API Key</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-surface-500">优先级</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-surface-500">状态</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-surface-500">余额</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-surface-500">备注</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-surface-500">操作</th>
              </tr></thead>
              <tbody>
                {poolKeys.map((k: any) => (
                  <tr key={k.id} className="border-b border-surface-100">
                    <td className="py-2.5 px-3 font-mono text-xs">{k.key_name || k.name}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-surface-600 max-w-[180px] truncate" title={k.api_key_enc ? "(加密存储)" : ""}>{k.key_prefix || "***"}</td>
                    <td className="py-2.5 px-3"><span className={cn("px-1.5 py-0.5 rounded text-xs font-bold", k.key_priority <= 1 ? "bg-red-100 text-red-700" : k.key_priority <= 3 ? "bg-amber-100 text-amber-700" : "bg-surface-100 text-surface-600")}>P{k.key_priority}</span></td>
                    <td className="py-2.5 px-3"><Badge variant={k.status === "active" ? "success" : "danger"}>{k.status}</Badge></td>
                    <td className="py-2.5 px-3">
                      {k.initial_balance_cents > 0 ? (
                        <div>
                          <div className="flex justify-between text-[10px] text-surface-500 mb-0.5"><span>¥{(k.balance_cents / 100).toFixed(2)}</span><span>¥{(k.initial_balance_cents / 100).toFixed(2)}</span></div>
                          <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden w-20">
                            <div className={cn("h-full rounded-full", (k.balance_cents / k.initial_balance_cents) > 0.5 ? "bg-emerald-500" : (k.balance_cents / k.initial_balance_cents) > 0.2 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.min(k.balance_cents / k.initial_balance_cents * 100, 100)}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-xs text-surface-400">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-surface-500 max-w-[100px] truncate">{k.notes || "-"}</td>
                    <td className="py-2.5 px-3 text-right flex gap-1 justify-end">
                      <button onClick={() => setEditingKey(editingKey?.id === k.id ? null : k)} className="p-1 rounded hover:bg-surface-100" title="编辑"><Settings className="w-3.5 h-3.5 text-surface-500" /></button>
                      <button onClick={() => handleDeleteKey(k.id)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Key Modal */}
        {editingKey && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setEditingKey(null)}>
            <div className="card bg-white p-6 w-full max-w-lg mx-4 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between"><h3 className="font-bold">编辑 Key</h3><button onClick={() => setEditingKey(null)}><X className="w-4 h-4" /></button></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs text-surface-600 mb-0.5 block">名称</label><input value={editingKey.key_name || editingKey.name} onChange={e => setEditingKey({ ...editingKey, key_name: e.target.value })} className="input-field" /></div>
                <div><label className="text-xs text-surface-600 mb-0.5 block">优先级</label><select value={editingKey.key_priority} onChange={e => setEditingKey({ ...editingKey, key_priority: +e.target.value })} className="input-field"><option value={0}>P0</option><option value={1}>P1</option><option value={2}>P2</option><option value={3}>P3</option><option value={4}>P4</option><option value={5}>P5</option></select></div>
                <div className="sm:col-span-2"><label className="text-xs text-surface-600 mb-0.5 block">API Key (留空不修改)</label><input value={editingKey._newKey || ""} onChange={e => setEditingKey({ ...editingKey, _newKey: e.target.value })} type="password" placeholder="留空则不修改" className="input-field" /></div>
                <div className="sm:col-span-2"><label className="text-xs text-surface-600 mb-0.5 block">Base URL</label><input value={editingKey.base_url || ""} onChange={e => setEditingKey({ ...editingKey, base_url: e.target.value })} className="input-field" /></div>
                <div><label className="text-xs text-surface-600 mb-0.5 block">并发数</label><input value={editingKey.max_concurrency} onChange={e => setEditingKey({ ...editingKey, max_concurrency: +e.target.value })} type="number" min={1} className="input-field" /></div>
                <div><label className="text-xs text-surface-600 mb-0.5 block">备注</label><input value={editingKey.notes || ""} onChange={e => setEditingKey({ ...editingKey, notes: e.target.value })} className="input-field" /></div>
              </div>
              <button onClick={async () => { try { await api.updateChannel({ id: editingKey.id, key_name: editingKey.key_name, key_priority: editingKey.key_priority, base_url: editingKey.base_url, max_concurrency: editingKey.max_concurrency, notes: editingKey.notes, ...(editingKey._newKey ? { api_key: editingKey._newKey } : {}) }); setEditingKey(null); toast.success("已更新"); loadPoolDetail(selectedPool.id) } catch (err: any) { toast.error(err.message) } }} className="btn-primary w-full">保存</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={loadPools} className="btn-secondary text-sm" disabled={loading}><RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />{t("common.refresh")}</button>
        <div className="flex gap-2">
          <button onClick={() => { setShowNewPool(false); setShowBatchImport(!showBatchImport) }} className="btn-secondary text-sm"><Plus className="w-4 h-4 mr-1.5" />批量导入</button>
          <button onClick={() => { setShowBatchImport(false); setShowNewPool(!showNewPool) }} className="btn-primary"><Plus className="w-4 h-4 mr-1.5" />新建模型池</button>
        </div>
      </div>

      {showNewPool && (
        <form onSubmit={handleCreatePool} className="card bg-white p-5 space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-bold">新建模型池</h3><button type="button" onClick={() => setShowNewPool(false)}><X className="w-4 h-4" /></button></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs text-surface-600 mb-0.5 block">模型名称 *</label><input value={newPool.name} onChange={e => setNewPool({ ...newPool, name: e.target.value })} placeholder="gpt-5.1" className="input-field" required /></div>
            <div><label className="text-xs text-surface-600 mb-0.5 block">显示名称</label><input value={newPool.display_name} onChange={e => setNewPool({ ...newPool, display_name: e.target.value })} placeholder="GPT 5.1" className="input-field" /></div>
            <div className="sm:col-span-2"><label className="text-xs text-surface-600 mb-0.5 block">计费模式</label>
              <select value={newPool.pricing_mode} onChange={e => setNewPool({ ...newPool, pricing_mode: e.target.value as any })} className="input-field">
                <option value="per_token">按量 — 每 1M Tokens 计费</option>
                <option value="per_call">按次 — 每次请求固定价格</option>
              </select>
            </div>
            {newPool.pricing_mode === "per_token" ? <>
              <div><label className="text-xs text-surface-600 mb-0.5 block">输入价格 (¥/1M Tokens)</label><input value={newPool.input_price} onChange={e => setNewPool({ ...newPool, input_price: +e.target.value })} type="number" min={0} step={0.1} className="input-field" /></div>
              <div><label className="text-xs text-surface-600 mb-0.5 block">输出价格 (¥/1M Tokens)</label><input value={newPool.output_price} onChange={e => setNewPool({ ...newPool, output_price: +e.target.value })} type="number" min={0} step={0.1} className="input-field" /></div>
            </> : <>
              <div className="sm:col-span-2"><label className="text-xs text-surface-600 mb-0.5 block">每次价格 (元/次)</label><input value={newPool.per_call_price} onChange={e => setNewPool({ ...newPool, per_call_price: +e.target.value })} type="number" min={0} step={0.01} className="input-field" /></div>
            </>}
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? "..." : "创建模型池"}</button>
        </form>
      )}

      {showBatchImport && (
        <div className="card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between"><h3 className="font-bold">批量导入 Key</h3><button onClick={() => setShowBatchImport(false)}><X className="w-4 h-4" /></button></div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="text-xs text-surface-600 mb-1 block">供应商</label>
              <select value={batchProvider} onChange={e => { const p=e.target.value; const baseUrls:Record<string,string>={deepseek:'https://api.deepseek.com',proaiapi:'https://proaiapi.tech',gemini:'https://generativelanguage.googleapis.com',custom:''}; setBatchProvider(p); setBatchBaseUrl(baseUrls[p]||'') }} className="input-field">
                <option value="deepseek">DeepSeek 官方</option><option value="gemini">Google AI Studio</option><option value="proaiapi">proaiapi</option><option value="custom">自定义</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label className="text-xs text-surface-600 mb-1 block">Base URL</label><input value={batchBaseUrl} onChange={e => setBatchBaseUrl(e.target.value)} className="input-field" placeholder="https://api.xxx.com" /></div>
          </div>
          <div><label className="text-xs text-surface-600 mb-1 block">每行一条: 用户Token | API Key | 模型(逗号分隔)</label>
            <textarea value={batchRows} onChange={e => setBatchRows(e.target.value)}
              placeholder={"sk-xxx|sk-xxx|gpt-4o,claude-4-haiku\nemail:pass|sk-yyy|gpt-4o-mini,gemini-3.5-flash"}
              className="input-field w-full h-40 font-mono text-xs" />
          </div>
          <p className="text-xs text-surface-500">
            格式: 用户Token | API Key | 模型列表（逗号分隔）。<br/>
            自动创建缺失的模型池，并将 Key 分配到对应池中。DeepSeek Token=API Key，proaiapi Token=邮箱:密码。
          </p>
          <button onClick={async () => {
            setBatchImporting(true)
            const lines = batchRows.split('\n').filter(l => l.trim())
            let created = 0
            for (const line of lines) {
              const parts = line.split('|').map(s => s.trim())
              if (parts.length < 3) continue
              const [token, apiKey, modelsStr] = parts
              const models = modelsStr.split(',').map(m => m.trim()).filter(Boolean)
              for (const model of models) {
                try {
                  // Find or create model pool
                  let poolId = ''
                  const existing = pools.find((p: any) => p.name === model)
                  if (existing) { poolId = existing.id }
                  else {
                    const res = await api.createModelPool({ name: model, display_name: model, input_price_cents: Math.round(newPool.input_price*100), output_price_cents: Math.round(newPool.output_price*100), pricing_mode: 'per_token' })
                    poolId = (res as any).id
                    await loadPools()
                  }
                  if (poolId) {
                    await api.createChannel({
                      name: model, provider: batchProvider, api_key: apiKey, base_url: batchBaseUrl,
                      models: [model], model_pool_id: poolId, key_priority: 3, key_name: model,
                      balance_provider: batchProvider, balance_token: token,
                      initial_balance_cents: 0, balance_cents: 0, weight: 1, priority: 0, max_concurrency: 10,
                    })
                    created++
                  }
                } catch {}
              }
            }
            setBatchImporting(false)
            if (created > 0) { toast.success(`成功导入 ${created} 条 Key`); setBatchRows(''); loadPools() }
            else { toast.error('没有有效的导入数据') }
          }} disabled={batchImporting} className="btn-primary">{batchImporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}开始导入</button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="card bg-white p-5"><Skeleton className="h-5 w-32 mb-3" /><Skeleton className="h-3 w-24 mb-2" /><Skeleton className="h-2 w-full" /></div>) : pools.length === 0 ? (
          <div className="col-span-full card bg-white p-12 text-center text-surface-500">暂无模型池，点击"新建模型池"创建</div>
        ) : pools.map(pool => (
          <div key={pool.id} className="card bg-white p-5 hover:ring-2 hover:ring-surface-950 transition-all relative group">
            <div onClick={() => loadPoolDetail(pool.id)} className="cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">{pool.display_name || pool.name}</h3>
                <ChevronRight className="w-4 h-4 text-surface-400" />
              </div>
              <p className="text-xs text-surface-500 font-mono mb-3">{pool.name}</p>
              <div className="flex justify-between text-xs text-surface-500 mb-2">
                <span>Key 活跃度</span>
                <span>{pool.active_keys || 0}/{pool.total_keys || 0}</span>
              </div>
              <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                <div className="h-full bg-surface-950 rounded-full transition-all" style={{ width: `${pool.total_keys > 0 ? ((pool.active_keys || 0) / pool.total_keys * 100) : 0}%` }} />
              </div>
              <div className="mt-3 text-xs text-surface-500">
                输入 ¥{(pool.input_price_cents / 100).toFixed(2)} / 输出 ¥{(pool.output_price_cents / 100).toFixed(2)} / 1M tokens
              </div>
              {pool.total_initial_balance > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-surface-500 mb-0.5"><span>余额</span><span>¥{(pool.total_balance / 100).toFixed(2)} / ¥{(pool.total_initial_balance / 100).toFixed(2)}</span></div>
                  <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", (pool.total_balance / pool.total_initial_balance) > 0.5 ? "bg-emerald-500" : (pool.total_balance / pool.total_initial_balance) > 0.2 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.min(pool.total_balance / pool.total_initial_balance * 100, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setDeletePoolId(pool.id) }}
              className="absolute bottom-3 right-3 p-1.5 rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              title="删除模型池">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Delete Pool Confirmation */}
      {deletePoolId && (
        <div className="fixed inset-0 z-50 bg-surface-950/30 flex items-center justify-center" onClick={() => setDeletePoolId(null)}>
          <div className="bg-white border border-surface-200 rounded-[20px] p-6 max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium mb-1">确定要删除该模型池？</p>
            <p className="text-xs text-surface-500 mb-4">删除后池内所有 Key 将失去关联，此操作不可撤销。</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletePoolId(null)} className="btn-secondary px-4 py-2 text-sm">取消</button>
              <button onClick={() => handleDeletePool(deletePoolId)} className="px-4 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors">确定删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-refresh balance every 60s when in pool detail */}
      {selectedPool && <BalanceRefresher poolKeys={poolKeys} loadPoolDetail={loadPoolDetail} selectedPool={selectedPool} />}
    </div>
  )
}

function BalanceRefresher({ poolKeys, loadPoolDetail, selectedPool }: { poolKeys: any[]; loadPoolDetail: (id: string) => void; selectedPool: any }) {
  const keysRef = useRef(poolKeys)
  keysRef.current = poolKeys

  useEffect(() => {
    const refresh = async () => {
      const keys = keysRef.current
      let changed = false
      for (const key of keys) {
        if (!key.balance_provider || !key.balance_token) continue
        try {
          const res = await fetch("/api/admin/channels/check-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ provider: key.balance_provider, token: key.balance_token }),
          })
          if (res.ok) {
            const data = await res.json()
            if (Math.abs(data.balance_cents - (key.balance_cents || 0)) > 0) {
              await fetch("/api/admin/channels", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ id: key.id, balance_cents: data.balance_cents }),
              })
              changed = true
            }
          }
        } catch {}
      }
      if (changed) loadPoolDetail(selectedPool.id)
    }
    // Run immediately on mount
    refresh()
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function PricingTab() {
  const { t } = useI18n()
  const [pricing, setPricing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ model_name: "", model_display: "", cost_input_price: 0, cost_output_price: 0, sell_input_price: 0, sell_output_price: 0, vip_discount: 0.9, enterprise_discount: 0.8 })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => { setLoading(true); try { setPricing(await api.getPricing()) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setSubmitting(true); try { await api.upsertPricing(form); toast.success(t(editing ? "admin.toast.pricingUpdated" : "admin.toast.pricingAdded")); setShowForm(false); load() } catch (err: any) { toast.error(err.message) } finally { setSubmitting(false) } }
  const toggleActive = async (id: string, cur: boolean) => { try { await api.togglePricing(id, !cur); load() } catch {} }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={load} className="btn-secondary text-sm" disabled={loading}><RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />{t("common.refresh")}</button>
        <button onClick={() => { setEditing(null); setForm({ model_name:"", model_display:"", cost_input_price:0, cost_output_price:0, sell_input_price:0, sell_output_price:0, vip_discount:0.9, enterprise_discount:0.8 }); setShowForm(true) }} className="btn-primary"><Plus className="w-4 h-4 mr-1.5" />{t("admin.pricing.newPricing")}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card bg-white p-6 space-y-4">
          <div className="flex items-center justify-between"><h3 className="font-bold">{t(editing ? "admin.pricing.formTitleEdit" : "admin.pricing.formTitleNew")}</h3><button type="button" onClick={() => setShowForm(false)} className="p-1 hover:bg-surface-100 rounded"><X className="w-4 h-4" /></button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.pricing.modelNameLabel")}</label><input value={form.model_name} onChange={e => setForm({...form, model_name: e.target.value})} placeholder={t("admin.pricing.modelNamePlaceholder")} className="input-field" required disabled={!!editing} /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.pricing.displayNameLabel")}</label><input value={form.model_display} onChange={e => setForm({...form, model_display: e.target.value})} className="input-field" /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.pricing.costInputLabel")}</label><input value={form.cost_input_price} onChange={e => setForm({...form, cost_input_price: +e.target.value})} type="number" step="0.01" className="input-field" /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.pricing.costOutputLabel")}</label><input value={form.cost_output_price} onChange={e => setForm({...form, cost_output_price: +e.target.value})} type="number" step="0.01" className="input-field" /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.pricing.sellInputLabel")}</label><input value={form.sell_input_price} onChange={e => setForm({...form, sell_input_price: +e.target.value})} type="number" step="0.01" className="input-field" /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.pricing.sellOutputLabel")}</label><input value={form.sell_output_price} onChange={e => setForm({...form, sell_output_price: +e.target.value})} type="number" step="0.01" className="input-field" /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.pricing.vipDiscountLabel")}</label><input value={form.vip_discount} onChange={e => setForm({...form, vip_discount: +e.target.value})} type="number" step="0.01" min={0} max={1} className="input-field" /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.pricing.enterpriseDiscountLabel")}</label><input value={form.enterprise_discount} onChange={e => setForm({...form, enterprise_discount: +e.target.value})} type="number" step="0.01" min={0} max={1} className="input-field" /></div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}{t(editing ? "admin.pricing.updateButton" : "admin.pricing.createButton")}</button>
        </form>
      )}

      <div className="card bg-white overflow-hidden">
        {loading ? <div className="p-6"><TableSkeleton rows={5} cols={7} /></div> : (
          <DataTable columns={[
            { key: "model_name", header: t("admin.pricing.colModel") },
            { key: "sell_input_price", header: t("admin.pricing.colSellIn"), render: (r: any) => `$${r.sell_input_price.toFixed(2)}` },
            { key: "sell_output_price", header: t("admin.pricing.colSellOut"), render: (r: any) => `$${r.sell_output_price.toFixed(2)}` },
            { key: "margin", header: t("admin.pricing.colMargin"), render: (r: any) => { const m = r.cost_input_price > 0 ? ((r.sell_input_price - r.cost_input_price) / r.cost_input_price * 100) : 0; return <Badge variant={m > 30 ? "success" : m > 10 ? "info" : "warning"}>{m.toFixed(0)}%</Badge> } },
            { key: "is_active", header: t("admin.pricing.colActive"), render: (r: any) => <Badge variant={r.is_active ? "success" : "default"}>{r.is_active ? t("common.yes") : t("common.no")}</Badge> },
            { key: "actions", header: t("admin.pricing.colActions"), render: (r: any) => <div className="flex gap-1"><button onClick={e => { e.stopPropagation(); setEditing(r); setForm({ model_name: r.model_name, model_display: r.model_display||"", cost_input_price: r.cost_input_price, cost_output_price: r.cost_output_price, sell_input_price: r.sell_input_price, sell_output_price: r.sell_output_price, vip_discount: r.vip_discount, enterprise_discount: r.enterprise_discount }); setShowForm(true) }} className="text-xs text-surface-500 hover:text-surface-950 px-2 py-1">{t("common.edit")}</button><button onClick={e => { e.stopPropagation(); toggleActive(r.id, r.is_active) }} className="text-xs text-surface-500 hover:text-surface-950 px-2 py-1">{r.is_active ? t("common.disable") : t("common.enable")}</button></div> },
          ]} data={pricing} emptyMessage={t("admin.pricing.empty")} />
        )}
      </div>
    </div>
  )
}

function BillingTab() {
  const { t } = useI18n()
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => { setLoading(true); try { const res = await api.getBillingRecords(page); setData(res.data); setTotal(res.total) } catch {} finally { setLoading(false) } }, [page])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={load} className="btn-secondary text-sm" disabled={loading}><RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />{t("common.refresh")}</button>
      </div>
      <div className="card bg-white overflow-hidden">
        {loading ? <div className="p-6"><TableSkeleton rows={10} cols={8} /></div> : (
          <DataTable columns={[
            { key: "created_at", header: t("admin.billing.colTime"), render: (r: any) => <span className="text-xs">{formatDate(r.created_at)}</span> },
            { key: "user_email", header: t("admin.billing.colUser") },
            { key: "model_name", header: t("admin.billing.colModel") },
            { key: "total_tokens", header: t("admin.billing.colTokens"), render: (r: any) => formatTokens(r.total_tokens) },
            { key: "cost_cents", header: t("admin.billing.colCost"), render: (r: any) => formatCents(r.cost_cents) },
            { key: "balance_after", header: t("admin.billing.colBalance"), render: (r: any) => formatCents(r.balance_after) },
            { key: "status", header: t("admin.billing.colStatus"), render: (r: any) => <Badge variant={r.status === "success" ? "success" : "danger"}>{r.status}</Badge> },
          ]} data={data} emptyMessage={t("admin.billing.empty")} />
        )}
      </div>
    </div>
  )
}
