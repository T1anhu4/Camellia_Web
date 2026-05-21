"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BarChart3, CreditCard, Database, Layers, Network, Plus, Search,
  Settings, Trash2, Users, X, RefreshCw, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { cn, formatTokens, formatCents, formatDate } from "@/lib/utils"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Skeleton, CardSkeleton, TableSkeleton } from "@/components/ui/skeleton"
import { LangSwitcher } from "@/components/ui/lang-switcher"

type AdminTab = "overview" | "users" | "channels" | "pricing" | "billing"

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview")
  const { t } = useI18n()

  const tabDescs: Record<AdminTab, string> = {
    overview: t("admin.tabDesc.overview"),
    users: t("admin.tabDesc.users"),
    channels: t("admin.tabDesc.channels"),
    pricing: t("admin.tabDesc.pricing"),
    billing: t("admin.tabDesc.billing"),
  }

  return (
    <div className="min-h-screen bg-surface-950 flex">
      <AdminSidebar tab={tab} onTabChange={setTab} />
      <main className="flex-1 p-6 lg:p-10 pt-20 lg:pt-10 ml-0 lg:ml-64">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
            <p className="text-gray-400 text-sm mt-1">{tabDescs[tab]}</p>
          </div>
          <LangSwitcher />
        </header>

        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "channels" && <ChannelsTab />}
        {tab === "pricing" && <PricingTab />}
        {tab === "billing" && <BillingTab />}
      </main>
    </div>
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
    <aside className="fixed top-0 left-0 h-full w-64 bg-surface-900/80 border-r border-white/5 p-6 z-10 hidden lg:block">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-sm">{t("admin.sidebar.title")}</span>
      </div>
      <nav className="space-y-1">
        {items.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all",
              tab === id
                ? "bg-rose-500/10 text-rose-400 font-medium"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

// ============================================================
// Overview Tab
// ============================================================
function OverviewTab() {
  const { t } = useI18n()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStats(await api.getAdminStats())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass p-12 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={load} className="btn-secondary">{t("common.retry")}</button>
      </div>
    )
  }

  const cards = [
    { label: t("admin.overview.totalUsers"), value: stats?.total_users ?? 0 },
    { label: t("admin.overview.activeChannels"), value: `${stats?.active_channels ?? 0} / ${stats?.active_channels ?? 0}` },
    { label: t("admin.overview.todayRevenue"), value: formatCents(stats?.today_revenue_cents ?? 0) },
    { label: t("admin.overview.todayTokens"), value: formatTokens(stats?.today_tokens ?? 0) },
  ]

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-hover p-5">
            <div className="text-gray-400 text-xs mb-1">{c.label}</div>
            <div className="text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="glass p-6">
        <h3 className="font-semibold mb-2">{t("admin.overview.systemStatus")}</h3>
        <p className="text-sm text-gray-500">
          {t("admin.overview.allOk", { n: stats?.total_requests_today ?? 0 })}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Users Tab
// ============================================================
function UsersTab() {
  const { t } = useI18n()
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, string | number>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.getUsers(page, search)
      setData(res.data); setTotal(res.total)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const saveField = async (userId: string, field: string, value: string | number) => {
    setSaving(`${userId}-${field}`)
    try {
      await api.patchUser(userId, { [field]: value })
      toast.success("已更新")
      load()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(null); setEditing({}) }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder={t("admin.users.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="input-field pl-10" />
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></button>
      </div>

      <div className="glass overflow-x-auto">
        {loading ? <div className="p-6"><TableSkeleton rows={8} cols={8} /></div> :
         error ? <div className="p-12 text-center text-red-400">{error}</div> :
         data.length === 0 ? <div className="p-12 text-center text-gray-500">{t("admin.users.noUsers")}</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5">
              {["邮箱","用户名","名称","角色","套餐","余额","Token配额","状态","备注","操作"].map(h => (
                <th key={h} className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map((r: any) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3 text-gray-400 text-xs max-w-[150px] truncate">{r.email}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{r.username || "-"}</td>
                  {/* Nickname — editable text */}
                  <td className="py-2 px-3">
                    <input
                      className="bg-transparent border border-transparent hover:border-white/20 focus:border-brand-500 rounded px-1.5 py-0.5 text-xs w-full min-w-[80px] text-gray-200"
                      defaultValue={r.nickname || ""}
                      onBlur={(e) => { if (e.target.value !== (r.nickname || "")) saveField(r.id, "nickname", e.target.value) }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                    />
                  </td>
                  {/* Role — dropdown */}
                  <td className="py-2 px-3">
                    <select className="bg-surface-800 border border-white/10 rounded px-1.5 py-0.5 text-xs text-gray-200" defaultValue={r.role} onChange={(e) => saveField(r.id, "role", e.target.value)}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  {/* Plan — dropdown */}
                  <td className="py-2 px-3">
                    <select className="bg-surface-800 border border-white/10 rounded px-1.5 py-0.5 text-xs text-gray-200" defaultValue={r.subscription_tier} onChange={(e) => saveField(r.id, "subscription_tier", e.target.value)}>
                      <option value="free">free</option>
                      <option value="vip">vip</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  {/* Balance — editable number */}
                  <td className="py-2 px-3">
                    <input
                      className="bg-transparent border border-transparent hover:border-white/20 focus:border-brand-500 rounded px-1.5 py-0.5 text-xs w-[80px] text-gray-200 font-mono"
                      defaultValue={r.balance_cents}
                      onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== r.balance_cents) saveField(r.id, "balance_cents", v) }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                    />
                  </td>
                  {/* Token quota — editable */}
                  <td className="py-2 px-3 text-xs">
                    <input
                      className="bg-transparent border border-transparent hover:border-white/20 focus:border-brand-500 rounded px-1.5 py-0.5 text-xs w-[70px] text-gray-200 font-mono"
                      defaultValue={r.daily_token_quota}
                      onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== r.daily_token_quota) saveField(r.id, "daily_token_quota", v) }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                    />
                    <span className="text-gray-600 ml-1">/ 已用{r.daily_token_used||0}</span>
                  </td>
                  {/* Status toggle */}
                  <td className="py-2 px-3">
                    <button
                      onClick={() => saveField(r.id, "status", r.status === "active" ? "disabled" : "active")}
                      className={cn("px-2 py-0.5 rounded text-xs font-medium transition-colors", r.status === "active" ? "bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-400" : "bg-red-500/20 text-red-400 hover:bg-emerald-500/20 hover:text-emerald-400")}
                    >
                      {r.status === "active" ? "启用" : "禁用"}
                    </button>
                  </td>
                  {/* Remark — editable text */}
                  <td className="py-2 px-3">
                    <input
                      className="bg-transparent border border-transparent hover:border-white/20 focus:border-brand-500 rounded px-1.5 py-0.5 text-xs w-full min-w-[100px] text-gray-400"
                      defaultValue={r.remark || ""}
                      placeholder="备注..."
                      onBlur={(e) => { if (e.target.value !== (r.remark || "")) saveField(r.id, "remark", e.target.value) }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                    />
                  </td>
                  {/* Actions */}
                  <td className="py-2 px-3">
                    {saving === `${r.id}-status` && <Loader2 className="w-3 h-3 animate-spin text-brand-400" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <span className="text-xs text-gray-500">{t("common.total", { n: total })}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm px-2 py-1">{t("common.page", { page, total: totalPages })}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Channels Tab
// ============================================================
function ChannelsTab() {
  const { t } = useI18n()
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", provider: "openai", api_key: "", base_url: "https://api.openai.com", models: "", weight: 1, priority: 0, max_concurrency: 10 })
  const [batchKeys, setBatchKeys] = useState("")

  const providerPresets: Record<string, { base: string; models: string }> = {
    openai: { base: "https://api.openai.com", models: "gpt-4o,gpt-4o-mini,gpt-4-turbo,gpt-3.5-turbo" },
    azure: { base: "https://YOUR-RESOURCE.openai.azure.com", models: "gpt-4,gpt-4o-mini" },
    anthropic: { base: "https://api.anthropic.com", models: "claude-4-sonnet,claude-4-haiku,claude-4-opus" },
    google: { base: "https://generativelanguage.googleapis.com", models: "gemini-pro,gemini-flash" },
    deepseek: { base: "https://api.deepseek.com", models: "deepseek-chat,deepseek-coder" },
    custom: { base: "", models: "" },
  }

  const handleProviderChange = (provider: string) => {
    const preset = providerPresets[provider] || { base: "", models: "" }
    setForm({ ...form, provider, base_url: preset.base, models: preset.models })
  }

  const handleBatchImport = async () => {
    const lines = batchKeys.split("\n").filter(l => l.trim())
    let count = 0
    for (const line of lines) {
      const parts = line.split("|").map(s => s.trim())
      if (parts.length < 3) continue
      try {
        await api.createChannel({
          name: parts[0] || "Imported",
          provider: parts[1] || "custom",
          api_key: parts[2],
          base_url: parts[3] || providerPresets[parts[1]]?.base || "",
          models: (parts[4] || "").split(",").map((s: string) => s.trim()).filter(Boolean),
          weight: 1,
          priority: 0,
          max_concurrency: 5,
        })
        count++
      } catch {}
    }
    if (count > 0) {
      toast.success(`成功导入 ${count} 个渠道`)
      setBatchKeys("")
      load()
    } else {
      toast.error("没有有效的导入数据")
    }
  }
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setChannels(await api.getChannels())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.createChannel({
        ...form,
        models: form.models.split(",").map((s) => s.trim()).filter(Boolean),
      })
      toast.success(t("admin.toast.channelCreated"))
      setShowForm(false)
      setForm({ name: "", provider: "openai", api_key: "", base_url: "", models: "gpt-4o-mini", weight: 1, priority: 0, max_concurrency: 10 })
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.channels.deleteConfirm"))) return
    try {
      await api.deleteChannel(id)
      toast.success(t("admin.toast.channelDeleted"))
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          {t("common.refresh")}
        </button>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4 mr-1.5" />
          {t("admin.channels.newChannel")}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{t("admin.channels.formTitle")}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.channels.nameLabel")}</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("admin.channels.namePlaceholder")} className="input-field" required />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.channels.providerLabel")}</label>
              <select value={form.provider} onChange={(e) => handleProviderChange(e.target.value)} className="input-field">
                {["openai","azure","anthropic","google","deepseek","custom"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.channels.apiKeyLabel")}</label>
              <input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} type="password" placeholder={t("admin.channels.apiKeyPlaceholder")} className="input-field" required />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.channels.baseUrlLabel")}</label>
              <input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder={t("admin.channels.baseUrlPlaceholder")} className="input-field" required />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.channels.modelsLabel")}</label>
              <input value={form.models} onChange={(e) => setForm({ ...form, models: e.target.value })} placeholder={t("admin.channels.modelsPlaceholder")} className="input-field" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{t("admin.channels.weightLabel")}</label>
                <input value={form.weight} onChange={(e) => setForm({ ...form, weight: +e.target.value })} type="number" min={1} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{t("admin.channels.priorityLabel")}</label>
                <input value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} type="number" min={0} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{t("admin.channels.concurrencyLabel")}</label>
                <input value={form.max_concurrency} onChange={(e) => setForm({ ...form, max_concurrency: +e.target.value })} type="number" min={1} className="input-field" />
              </div>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            {t("admin.channels.createButton")}
          </button>
        </form>
      )}

      {/* Batch import */}
      <div className="glass p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">批量导入渠道 Key</h3>
          <span className="text-xs text-gray-500">格式: 名称|供应商|APIKey|BaseURL|模型(逗号分隔)</span>
        </div>
        <textarea
          value={batchKeys}
          onChange={e => setBatchKeys(e.target.value)}
          placeholder={"OpenAI-Prod|openai|sk-xxx|https://api.openai.com|gpt-4o,gpt-4o-mini\nQwen3.5|custom|sk-yyy|https://api.qwen.com|qwen3.5\nGPT3|custom|sk-zzz|https://api.openai.com|gpt-3\nGPT3.5|custom|sk-www|https://api.openai.com|gpt-3.5-turbo"}
          className="input-field w-full h-24 font-mono text-xs"
        />
        <button onClick={handleBatchImport} className="btn-secondary text-xs py-1.5 px-3">批量导入</button>
      </div>

      {/* Channel list */}
      <div className="glass overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={7} /></div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">{error}</div>
        ) : (
          <DataTable
            columns={[
              { key: "name", header: t("admin.channels.colName") },
              {
                key: "provider", header: t("admin.channels.colProvider"),
                render: (r) => <Badge>{r.provider}</Badge>,
              },
              {
                key: "models", header: t("admin.channels.colModels"),
                render: (r) => (
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(r.models || []).slice(0, 3).map((m: string) => (
                      <Badge key={m} variant="info">{m}</Badge>
                    ))}
                    {(r.models || []).length > 3 && <Badge>+{r.models.length - 3}</Badge>}
                  </div>
                ),
              },
              {
                key: "status", header: t("admin.channels.colStatus"),
                render: (r) => (
                  <Badge variant={r.status === "active" ? "success" : r.status === "rate_limited" ? "warning" : "danger"}>
                    {r.status}
                  </Badge>
                ),
              },
              { key: "weight", header: t("admin.channels.colWeight") },
              { key: "max_concurrency", header: t("admin.channels.colConcurrency") },
              {
                key: "actions", header: t("admin.channels.colActions"),
                render: (r) => (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                ),
              },
            ]}
            data={channels}
            emptyMessage={t("admin.channels.empty")}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Pricing Tab
// ============================================================
function PricingTab() {
  const { t } = useI18n()
  const [pricing, setPricing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ model_name: "", model_display: "", cost_input_price: 0, cost_output_price: 0, sell_input_price: 0, sell_output_price: 0, vip_discount: 0.9, enterprise_discount: 0.8 })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPricing(await api.getPricing())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openForm = (item?: any) => {
    if (item) {
      setEditing(item)
      setForm({
        model_name: item.model_name,
        model_display: item.model_display || "",
        cost_input_price: item.cost_input_price,
        cost_output_price: item.cost_output_price,
        sell_input_price: item.sell_input_price,
        sell_output_price: item.sell_output_price,
        vip_discount: item.vip_discount,
        enterprise_discount: item.enterprise_discount,
      })
    } else {
      setEditing(null)
      setForm({ model_name: "", model_display: "", cost_input_price: 0, cost_output_price: 0, sell_input_price: 0, sell_output_price: 0, vip_discount: 0.9, enterprise_discount: 0.8 })
    }
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.upsertPricing(form)
      toast.success(t(editing ? "admin.toast.pricingUpdated" : "admin.toast.pricingAdded"))
      setShowForm(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.togglePricing(id, !current)
      toast.success(t(current ? "admin.toast.pricingDeactivated" : "admin.toast.pricingActivated"))
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          {t("common.refresh")}
        </button>
        <button onClick={() => openForm()} className="btn-primary">
          <Plus className="w-4 h-4 mr-1.5" />
          {t("admin.pricing.newPricing")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{t(editing ? "admin.pricing.formTitleEdit" : "admin.pricing.formTitleNew")}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.pricing.modelNameLabel")}</label>
              <input value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} placeholder={t("admin.pricing.modelNamePlaceholder")} className="input-field" required disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.pricing.displayNameLabel")}</label>
              <input value={form.model_display} onChange={(e) => setForm({ ...form, model_display: e.target.value })} placeholder={t("admin.pricing.displayNamePlaceholder")} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.pricing.costInputLabel")}</label>
              <input value={form.cost_input_price} onChange={(e) => setForm({ ...form, cost_input_price: +e.target.value })} type="number" step="0.01" className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.pricing.costOutputLabel")}</label>
              <input value={form.cost_output_price} onChange={(e) => setForm({ ...form, cost_output_price: +e.target.value })} type="number" step="0.01" className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.pricing.sellInputLabel")}</label>
              <input value={form.sell_input_price} onChange={(e) => setForm({ ...form, sell_input_price: +e.target.value })} type="number" step="0.01" className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.pricing.sellOutputLabel")}</label>
              <input value={form.sell_output_price} onChange={(e) => setForm({ ...form, sell_output_price: +e.target.value })} type="number" step="0.01" className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.pricing.vipDiscountLabel")}</label>
              <input value={form.vip_discount} onChange={(e) => setForm({ ...form, vip_discount: +e.target.value })} type="number" step="0.01" min={0} max={1} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t("admin.pricing.enterpriseDiscountLabel")}</label>
              <input value={form.enterprise_discount} onChange={(e) => setForm({ ...form, enterprise_discount: +e.target.value })} type="number" step="0.01" min={0} max={1} className="input-field" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            {t(editing ? "admin.pricing.updateButton" : "admin.pricing.createButton")}
          </button>
        </form>
      )}

      <div className="glass overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={7} /></div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">{error}</div>
        ) : (
          <DataTable
            columns={[
              { key: "model_name", header: t("admin.pricing.colModel") },
              {
                key: "sell_input_price", header: t("admin.pricing.colSellIn"),
                render: (r) => `$${r.sell_input_price.toFixed(2)}`,
              },
              {
                key: "sell_output_price", header: t("admin.pricing.colSellOut"),
                render: (r) => `$${r.sell_output_price.toFixed(2)}`,
              },
              {
                key: "cost_input_price", header: t("admin.pricing.colCostIn"),
                render: (r) => `$${r.cost_input_price.toFixed(2)}`,
              },
              {
                key: "margin", header: t("admin.pricing.colMargin"),
                render: (r) => {
                  const m = r.cost_input_price > 0 ? ((r.sell_input_price - r.cost_input_price) / r.cost_input_price * 100) : 0
                  return <Badge variant={m > 30 ? "success" : m > 10 ? "info" : "warning"}>{m.toFixed(0)}%</Badge>
                },
              },
              {
                key: "is_active", header: t("admin.pricing.colActive"),
                render: (r) => <Badge variant={r.is_active ? "success" : "default"}>{r.is_active ? t("common.yes") : t("common.no")}</Badge>,
              },
              {
                key: "actions", header: t("admin.pricing.colActions"),
                render: (r) => (
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openForm(r) }} className="text-xs text-gray-400 hover:text-white px-2 py-1">{t("common.edit")}</button>
                    <button onClick={(e) => { e.stopPropagation(); toggleActive(r.id, r.is_active) }} className="text-xs text-gray-400 hover:text-white px-2 py-1">
                      {r.is_active ? t("common.disable") : t("common.enable")}
                    </button>
                  </div>
                ),
              },
            ]}
            data={pricing}
            emptyMessage={t("admin.pricing.empty")}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Billing Tab
// ============================================================
function BillingTab() {
  const { t } = useI18n()
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getBillingRecords(page)
      setData(res.data)
      setTotal(res.total)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          {t("common.refresh")}
        </button>
      </div>

      <div className="glass overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={10} cols={8} /></div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">{error}</div>
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: "created_at", header: t("admin.billing.colTime"),
                  render: (r) => <span className="text-xs">{formatDate(r.created_at)}</span>,
                  className: "whitespace-nowrap",
                },
                { key: "user_email", header: t("admin.billing.colUser") },
                { key: "model_name", header: t("admin.billing.colModel") },
                { key: "total_tokens", header: t("admin.billing.colTokens"), render: (r) => formatTokens(r.total_tokens) },
                { key: "cost_cents", header: t("admin.billing.colCost"), render: (r) => formatCents(r.cost_cents) },
                { key: "balance_after", header: t("admin.billing.colBalance"), render: (r) => formatCents(r.balance_after) },
                {
                  key: "status", header: t("admin.billing.colStatus"),
                  render: (r) => <Badge variant={r.status === "success" ? "success" : "danger"}>{r.status}</Badge>,
                },
              ]}
              data={data}
              emptyMessage={t("admin.billing.empty")}
            />
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <span className="text-xs text-gray-500">{t("common.total", { n: total })}</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm px-2 py-1">{t("common.page", { page, total: totalPages })}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
