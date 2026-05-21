const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers as Record<string, string>,
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `HTTP ${res.status}`)
    }

    return res.json()
  }

  private get<T>(path: string) { return this.request<T>(path) }
  private post<T>(path: string, body?: unknown) { return this.request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }) }
  private patch<T>(path: string, body?: unknown) { return this.request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }) }
  private del<T>(path: string) { return this.request<T>(path, { method: "DELETE" }) }

  // --- Auth ---
  async login(login: string, password: string) {
    return this.post<{ token: string; user: Record<string, unknown> }>("/api/auth/login", { login, password })
  }
  async registerStart(email: string, username: string, password: string) {
    return this.post<{ needVerify?: boolean }>("/api/auth/register", { email, username, password })
  }
  async registerVerify(email: string, username: string, password: string, code: string) {
    return this.post<{ token: string; user: Record<string, unknown> }>("/api/auth/register", { email, username, password, code })
  }
  async changePassword(oldPassword: string, newPassword: string) {
    return this.patch("/api/auth/password", { oldPassword, newPassword })
  }
  async me() { return this.get<{ user: Record<string, unknown> }>("/api/auth/me") }
  async updateMe(data: Record<string, unknown>) { return this.patch<{ user: Record<string, unknown> }>("/api/auth/me", data) }
  async logout() { return this.post("/api/auth/logout") }

  // --- Dashboard ---
  async getModelUsage() {
    return this.get<Array<{ model_name: string; total_requests: number; total_tokens: number; total_cost: number }>>("/api/dashboard/model-usage")
  }
  async getUsage(start: string, end: string) {
    return this.get<{ data: Array<{ date: string; tokens: number; cost: number; requests: number }>; totals: Record<string, number> }>(
      `/api/dashboard/usage?start=${start}&end=${end}`
    )
  }
  async getMyStats() {
    return this.get<{ total_tokens: number; total_cost: number; total_requests: number }>("/api/dashboard/stats")
  }

  // --- Billing ---
  async getMyBillingRecords() {
    return this.get<Array<{ id: number; model_name: string; total_tokens: number; cost_cents: number; balance_after: number; status: string; created_at: string }>>(
      "/api/billing/records"
    )
  }

  // --- API Keys ---
  async getApiKeys() { return this.get<any[]>("/api/keys") }
  async createApiKey() { return this.post<{ id: string; key: string; name: string; key_prefix: string }>("/api/keys") }
  async deleteApiKey(id: string) { return this.del(`/api/keys/${id}`) }

  // --- Admin: Stats ---
  async getAdminStats() { return this.get<any>("/api/admin/stats") }

  // --- Admin: Users ---
  async getUsers(page = 1, search = "") { return this.get<any>(`/api/admin/users?page=${page}&page_size=20&search=${encodeURIComponent(search)}`) }
  async toggleUserStatus(userId: string, status: string) { return this.patch("/api/admin/users", { user_id: userId, status }) }
  async patchUser(userId: string, fields: Record<string, any>) { return this.patch("/api/admin/users", { user_id: userId, ...fields }) }

  // --- Admin: Channels ---
  async getChannels() { return this.get<any[]>("/api/admin/channels") }
  async createChannel(data: Record<string, unknown>) { return this.post("/api/admin/channels", data) }
  async deleteChannel(id: string) { return this.del(`/api/admin/channels?id=${id}`) }
  async getModelPools() { return this.get<any[]>("/api/admin/model-pools") }
  async getModelPool(id: string) { return this.get<{ pool: any; keys: any[] }>(`/api/admin/model-pools?id=${id}`) }
  async createModelPool(data: Record<string, unknown>) { return this.post("/api/admin/model-pools", data) }
  async updateModelPool(data: Record<string, unknown>) { return this.patch("/api/admin/model-pools", data) }
  async deleteModelPool(id: string) { return this.del(`/api/admin/model-pools?id=${id}`) }
  async updateChannel(data: Record<string, unknown>) { return this.patch("/api/admin/channels", data) }

  // --- Admin: Pricing ---
  async getPricing() { return this.get<any[]>("/api/admin/pricing") }
  async upsertPricing(data: Record<string, unknown>) { return this.post("/api/admin/pricing", data) }
  async togglePricing(id: string, isActive: boolean) { return this.patch("/api/admin/pricing", { id, is_active: isActive }) }

  // --- Admin: Billing ---
  async getBillingRecords(page = 1, userId = "") {
    return this.get<any>(`/api/admin/billing?page=${page}&page_size=20&user_id=${encodeURIComponent(userId)}`)
  }
}

export const api = new ApiClient()
