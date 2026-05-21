"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Key, Loader2, Copy, Trash2, AlertCircle, Check } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useAuth } from "@/hooks/use-auth"
import { formatDate } from "@/lib/utils"

export default function KeysPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    try { setKeys(await api.getApiKeys()) } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  const handleCreate = async () => {
    try { const key = await api.createApiKey(); setNewKey(key); toast.success(t("dashboard.toast.keyCreated")); loadKeys() }
    catch (err: any) { toast.error(err.message) }
  }

  const handleDelete = async (id: string) => {
    try { await api.deleteApiKey(id); toast.success(t("dashboard.toast.keyDeleted")); setDeleteId(null); loadKeys() }
    catch (err: any) { toast.error(err.message) }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-[28px] font-bold mb-6">{t("nav.apiKeys")}</h1>

      {/* Create Key */}
      <div className="card bg-white p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{t("dashboard.keys.createTitle")}</h3>
          <button onClick={handleCreate} className="btn-primary px-4 py-2 text-sm h-[40px]">
            <Key className="w-4 h-4 mr-1.5" />{t("dashboard.keys.createButton")}
          </button>
        </div>

        {newKey && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-3"><AlertCircle className="w-4 h-4" />{t("dashboard.keys.warning")}</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 rounded-xl bg-surface-950 text-green-400 font-mono text-sm break-all tracking-wide">{newKey.key}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKey.key); toast.success(t("dashboard.toast.copied")) }}
                className="p-2.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-600 hover:text-surface-950 transition-colors flex-shrink-0">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-surface-500 mt-2">{t("dashboard.keys.usageHint")}</p>
          </motion.div>
        )}
      </div>

      {/* Keys List */}
      <div className="card bg-white p-6">
        <h3 className="font-bold mb-4">{t("dashboard.keys.yourKeys")} ({keys.length})</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-surface-400 animate-spin" /></div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-surface-500 text-sm">{t("dashboard.keys.empty")}</div>
        ) : (
          <div className="space-y-2">
            {keys.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between p-3.5 rounded-xl bg-surface-50 border border-surface-200">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-medium text-surface-800">{k.key_prefix}••••••••</code>
                    {!k.is_enabled && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">{t("dashboard.keys.disabledBadge")}</span>}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">
                    {k.name} · {k.last_used_at ? t("dashboard.keys.lastUsed", { date: formatDate(k.last_used_at) }) : t("common.noData")}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setDeleteId(deleteId === k.id ? null : k.id)} className="p-2 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors" title={t("dashboard.keys.deleteTooltip")}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/30 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
          <div className="bg-white border border-surface-200 rounded-[20px] p-6 max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm mb-4">{t("dashboard.keys.deleteConfirm")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors">{t("common.delete")}</button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
