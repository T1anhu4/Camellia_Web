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
    try { setKeys(await api.getApiKeys()) } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  const handleCreate = async () => {
    try {
      const key = await api.createApiKey()
      setNewKey(key)
      toast.success(t("dashboard.toast.keyCreated"))
      loadKeys()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteApiKey(id)
      toast.success(t("dashboard.toast.keyDeleted"))
      setDeleteId(null)
      loadKeys()
    } catch (err: any) { toast.error(err.message) }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("nav.apiKeys")}</h1>

      {/* Create Key */}
      <div className="glass p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t("dashboard.keys.createTitle")}</h3>
          <button onClick={handleCreate} className="btn-primary px-4 py-2 text-sm">
            <Key className="w-4 h-4 mr-1.5" />{t("dashboard.keys.createButton")}
          </button>
        </div>

        {newKey && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm mb-2"><AlertCircle className="w-4 h-4" />{t("dashboard.keys.warning")}</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded bg-black/30 text-brand-300 font-mono text-sm break-all">{newKey.key}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKey.key); toast.success(t("dashboard.toast.copied")) }} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">{t("dashboard.keys.usageHint")}</p>
          </motion.div>
        )}
      </div>

      {/* Keys List */}
      <div className="glass p-6">
        <h3 className="font-semibold mb-4">{t("dashboard.keys.yourKeys")} ({keys.length})</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-brand-400 animate-spin" /></div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">{t("dashboard.keys.empty")}</div>
        ) : (
          <div className="space-y-2">
            {keys.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-gray-300">{k.key_prefix}...</code>
                    {!k.is_enabled && <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400">{t("dashboard.keys.disabledBadge")}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {k.name} · {k.last_used_at ? t("dashboard.keys.lastUsed", { date: formatDate(k.last_used_at) }) : t("common.noData")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigator.clipboard.writeText(k.key_prefix)} className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-gray-300" title={t("dashboard.toast.copied")}><Copy className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteId(deleteId === k.id ? null : k.id)} className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400" title={t("dashboard.keys.deleteTooltip")}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDeleteId(null)}>
          <div className="glass p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm mb-4">{t("dashboard.keys.deleteConfirm")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors">{t("common.delete")}</button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
