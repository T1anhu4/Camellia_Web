"use client"

import { useState, useEffect, useCallback } from "react"
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
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", provider: "openai", api_key: "", base_url: "https://api.openai.com", models: "", weight: 1, priority: 0, max_concurrency: 10 })
  const [submitting, setSubmitting] = useState(false)

  const providerPresets: Record<string, { base: string; models: string }> = {
    openai: { base: "https://api.openai.com", models: "gpt-4o,gpt-4o-mini,gpt-4-turbo" },
    azure: { base: "https://YOUR-RESOURCE.openai.azure.com", models: "gpt-4,gpt-4o-mini" },
    anthropic: { base: "https://api.anthropic.com", models: "claude-4-sonnet,claude-4-haiku" },
    google: { base: "https://generativelanguage.googleapis.com", models: "gemini-pro,gemini-flash" },
    deepseek: { base: "https://api.deepseek.com", models: "deepseek-chat,deepseek-coder" },
    custom: { base: "", models: "" },
  }

  const load = useCallback(async () => { setLoading(true); try { setChannels(await api.getChannels()) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true)
    try { await api.createChannel({ ...form, models: form.models.split(",").map(s => s.trim()).filter(Boolean) }); toast.success(t("admin.toast.channelCreated")); setShowForm(false); load() }
    catch (err: any) { toast.error(err.message) } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => { if (!confirm(t("admin.channels.deleteConfirm"))) return; try { await api.deleteChannel(id); toast.success(t("admin.toast.channelDeleted")); load() } catch (err: any) { toast.error(err.message) } }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={load} className="btn-secondary text-sm" disabled={loading}><RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />{t("common.refresh")}</button>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus className="w-4 h-4 mr-1.5" />{t("admin.channels.newChannel")}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card bg-white p-6 space-y-4">
          <div className="flex items-center justify-between"><h3 className="font-bold">{t("admin.channels.formTitle")}</h3><button type="button" onClick={() => setShowForm(false)} className="p-1 hover:bg-surface-100 rounded"><X className="w-4 h-4" /></button></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.channels.nameLabel")}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t("admin.channels.namePlaceholder")} className="input-field" required /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.channels.providerLabel")}</label>
              <select value={form.provider} onChange={e => { const preset = providerPresets[e.target.value] || { base: "", models: "" }; setForm({ ...form, provider: e.target.value, base_url: preset.base, models: preset.models }) }} className="input-field">
                {["openai","azure","anthropic","google","deepseek","custom"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.channels.apiKeyLabel")}</label><input value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} type="password" placeholder={t("admin.channels.apiKeyPlaceholder")} className="input-field" required /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.channels.baseUrlLabel")}</label><input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} placeholder={t("admin.channels.baseUrlPlaceholder")} className="input-field" required /></div>
            <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.channels.modelsLabel")}</label><input value={form.models} onChange={e => setForm({ ...form, models: e.target.value })} placeholder={t("admin.channels.modelsPlaceholder")} className="input-field" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.channels.weightLabel")}</label><input value={form.weight} onChange={e => setForm({ ...form, weight: +e.target.value })} type="number" min={1} className="input-field" /></div>
              <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.channels.priorityLabel")}</label><input value={form.priority} onChange={e => setForm({ ...form, priority: +e.target.value })} type="number" min={0} className="input-field" /></div>
              <div><label className="text-xs text-surface-600 mb-1 block">{t("admin.channels.concurrencyLabel")}</label><input value={form.max_concurrency} onChange={e => setForm({ ...form, max_concurrency: +e.target.value })} type="number" min={1} className="input-field" /></div>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}{t("admin.channels.createButton")}</button>
        </form>
      )}

      <div className="card bg-white overflow-hidden">
        {loading ? <div className="p-6"><TableSkeleton rows={5} cols={7} /></div> : (
          <DataTable columns={[
            { key: "name", header: t("admin.channels.colName") },
            { key: "provider", header: t("admin.channels.colProvider"), render: (r: any) => <Badge>{r.provider}</Badge> },
            { key: "models", header: t("admin.channels.colModels"), render: (r: any) => <div className="flex flex-wrap gap-1 max-w-[200px]">{(r.models||[]).slice(0,3).map((m:string) => <Badge key={m} variant="info">{m}</Badge>)}</div> },
            { key: "status", header: t("admin.channels.colStatus"), render: (r: any) => <Badge variant={r.status==="active"?"success":"danger"}>{r.status}</Badge> },
            { key: "weight", header: t("admin.channels.colWeight") },
            { key: "max_concurrency", header: t("admin.channels.colConcurrency") },
            { key: "actions", header: t("admin.channels.colActions"), render: (r: any) => <button onClick={e => { e.stopPropagation(); handleDelete(r.id) }} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-500" /></button> },
          ]} data={channels} emptyMessage={t("admin.channels.empty")} />
        )}
      </div>
    </div>
  )
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
