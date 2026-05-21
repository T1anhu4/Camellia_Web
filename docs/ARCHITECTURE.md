# LLM Gateway — 企业级大模型 API 统一调度网关

## 完整技术文档与生产部署指南

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构总览](#2-技术架构总览)
3. [数据库设计](#3-数据库设计)
4. [Redis 缓存架构](#4-redis-缓存架构)
5. [核心网关引擎](#5-核心网关引擎)
6. [计费引擎](#6-计费引擎)
7. [前端与用户中台](#7-前端与用户中台)
8. [管理后台](#8-管理后台)
9. [支付抽象层](#9-支付抽象层)
10. [安全设计](#10-安全设计)
11. [可观测性](#11-可观测性)
12. [生产部署指南](#12-生产部署指南)

---

## 1. 项目概述

### 1.1 定位

LLM Gateway 是一套**企业级大模型 API 统一调度网关与商业化分发平台**，解决以下核心问题：

- **多供应商管理**：统一管理 OpenAI、Azure、Anthropic、DeepSeek 等多个上游 API Key
- **智能路由**：自动负载均衡、故障切换、熔断保护
- **商业化分发**：按量计费 + 订阅制，将大模型能力作为 SaaS 产品分发给下游客户
- **开箱即用**：Docker 一键部署，自动 HTTPS，Prometheus 监控

### 1.2 核心能力矩阵

| 能力域 | 具体功能 |
|--------|---------|
| 协议兼容 | 完全兼容 OpenAI `/v1/chat/completions`、`/v1/embeddings`、`/v1/models` |
| 流式支持 | SSE (Server-Sent Events) 实时流式转发，零缓冲延迟 |
| 负载均衡 | 优先级 → 可用容量 → 权重 三级排序，Redis 原子并发计数 |
| 熔断保护 | 三态熔断器 (Closed → Open → Half-Open)，按错误码差异化冷却 |
| 限流控制 | 五级限流：全局连接 → IP → RPM → 并发数 → TPM |
| 计费 | tiktoken 精确分词，输入/输出分别定价，VIP/Enterprise 折扣 |
| 鉴权 | API Key (SHA-256) + JWT Session，Redis 热点缓存 |
| 部署 | Docker Compose 一键启动，Caddy 自动 HTTPS |
| 监控 | Prometheus `/metrics` 端点，结构化日志 |

### 1.3 技术栈

| 层 | 技术选型 | 理由 |
|---|---------|------|
| 网关 | Go 1.22 + Fiber v2 | 极高并发 (256k connections)，<1ms 路由开销 |
| 前端 | Next.js 14 (App Router) + React 18 | SSR/SSG 混合渲染，Edge Middleware |
| UI | TailwindCSS + Framer Motion + Recharts | 原子化 CSS + 声明式动画 + 图表 |
| 数据库 | PostgreSQL 16 | 持久化存储，ACID 事务，窗口函数分析 |
| 缓存 | Redis 7 | 鉴权缓存、限流计数器、渠道状态、定价热数据 |
| 代理 | Caddy 2 | 自动 Let's Encrypt SSL，HTTP/2，零配置反向代理 |
| 容器 | Docker + Buildx | 多架构 (amd64/arm64)，BuildKit 缓存加速 |
| CI/CD | GitHub Actions | 自动测试 → 多架构构建 → 推送 → SSH 部署 |
| 支付 | Stripe (抽象层) | 预留 Alipay/WeChat Pay 接口 |

---

## 2. 技术架构总览

### 2.1 系统拓扑

```
                          ┌──────────────┐
                          │   End User   │
                          └──────┬───────┘
                                 │ HTTPS
                                 ▼
                    ┌─────────────────────────┐
                    │  Caddy (Auto SSL + LB)   │
                    │  Rate Limit: 60req/10s   │
                    │  Headers: Security + CORS│
                    └────┬────────────┬───────┘
                         │            │
              /v1/*      │            │   /, /dashboard, /admin
                         ▼            ▼
              ┌──────────────┐  ┌──────────────────┐
              │ Go Gateway   │  │  Next.js App      │
              │ (Fiber)      │  │  (Node.js SSR)    │
              │              │  │                    │
              │ Auth Middle  │  │  /api/auth/*      │
              │ Rate Limiter │  │  /api/dashboard/* │
              │ Channel Pool │  │  /api/keys/*      │
              │ SSE Proxy    │  │  /api/admin/*     │
              │ Billing      │  │  /api/billing/*   │
              └──┬───────┬───┘  └────┬─────────────┘
                 │       │           │
                 ▼       ▼           ▼
           ┌─────────┐ ┌─────────┐ ┌──────────────┐
           │PostgreSQL│ │  Redis   │ │ Upstream LLM │
           │ (数据持久)│ │(缓存/限流)│ │(OpenAI etc)  │
           └─────────┘ └─────────┘ └──────────────┘
```

### 2.2 请求生命周期

以下是一个完整的 `/v1/chat/completions` 请求经过系统的全链路：

```
Client Request (Bearer sk-xxx)
    │
    ▼
┌─ Caddy ───────────────────────────────────────────────────┐
│  1. TLS termination (Let's Encrypt)                        │
│  2. Rate limit check (IP-based, 60 req/10s)               │
│  3. Security headers injection                             │
│  4. Proxy to gateway:8080                                  │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Go Gateway ───────────────────────────────────────────────┐
│  5. Global connection limiter (10k hard cap)               │
│  6. Auth Middleware:                                        │
│     a. Extract API Key from Authorization header           │
│     b. SHA-256 hash the key                                │
│     c. Redis HGetAll "apikey:{hash}" (hot path, <1ms)     │
│     d. Fallback: PostgreSQL query + populate Redis (5min)  │
│     e. Inject user_id, tier, rpm_limit into Locals        │
│                                                            │
│  7. Multi-tier Rate Limiting:                              │
│     Tier 1: IP sliding window (300 RPM)                    │
│     Tier 2: User RPM sliding window (tier-based)           │
│     Tier 3: User concurrency slot (Redis INCR atomic)      │
│     Tier 4: tiktoken count prompt tokens                   │
│     Tier 5: TPM pre-check (estimated)                      │
│                                                            │
│  8. Pre-request billing checks:                            │
│     a. Quota enforcer: check daily token quota (Redis)     │
│     b. Balance checker: verify sufficient balance (DB)     │
│     c. Free tier: reject if 0 balance (402 Payment Required)│
│                                                            │
│  9. Channel Pool: AcquireChannel(model)                    │
│     a. Build channel snapshots (read lock)                 │
│     b. Sort: priority ↓ → available capacity ↓ → weight ↓ │
│     c. Circuit breaker check (local, fast path)            │
│     d. Redis INCR {channel}:concurrency (atomic acquire)   │
│     e. Overflow rollback: DECR if > maxConcurrency         │
│                                                            │
│ 10. executeWithRetry (exponential backoff):                │
│     Attempt 1: proxy to upstream → fail (429/5xx)          │
│       → MarkError (circuit breaker)                        │
│       → ReleaseChannel (Redis DECR)                        │
│       → Wait 200ms (base backoff)                          │
│     Attempt 2: re-acquire channel → fail                   │
│       → Wait 400ms                                         │
│     Attempt 3: re-acquire channel → success                │
│                                                            │
│ 11. Response handling:                                     │
│     NON-STREAMING:                                         │
│       a. Buffer full response body                         │
│       b. ParseResponseUsage() → extract prompt/completion  │
│       c. Enqueue BillingTask → Worker Pool                 │
│       d. RecordSuccess (circuit breaker close)             │
│       e. Return JSON to client                             │
│                                                            │
│     STREAMING (SSE):                                       │
│       a. Set SSE headers (text/event-stream)               │
│       b. BodyStreamWriter: read upstream line by line      │
│       c. Parse "data: {usage:...}" for token counts        │
│       d. Detect client disconnect (Context.Done())         │
│       e. On [DONE]: enqueue BillingTask                    │
│       f. ReleaseChannel on stream end                      │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Billing Worker Pool (async) ─────────────────────────────┐
│ 12. Worker receives BillingTask from buffered channel      │
│ 13. Add to local buffer (200 capacity)                     │
│ 14. Flush trigger: buffer full OR 1s periodic tick         │
│ 15. Batch PostgreSQL transaction:                          │
│     a. UPDATE users SET balance_cents -= cost              │
│     b. INSERT INTO billing_records                         │
│     c. Redis INCRBY user:{id}:daily_tokens                 │
│ 16. Commit transaction                                     │
└──────────────────────────────────────────────────────────┘
```

### 2.3 项目目录结构

```
llm-gateway/
├── gateway/                          # Go 网关
│   ├── cmd/server/main.go            # 入口：依赖注入、路由注册
│   ├── internal/
│   │   ├── billing/
│   │   │   ├── payment/provider.go   # 支付抽象接口
│   │   │   ├── payment/stripe.go     # Stripe 实现 (可替换)
│   │   │   ├── pricing.go            # 定价引擎 (三级缓存)
│   │   │   ├── quota.go              # 配额执行器
│   │   │   ├── record.go             # 计费记录 (底层直写)
│   │   │   └── worker.go             # 异步 Worker Pool
│   │   ├── config/config.go          # 12-factor 环境配置
│   │   ├── db/
│   │   │   ├── postgres.go           # pgxpool 连接池
│   │   │   └── redis.go              # go-redis 客户端
│   │   ├── handler/
│   │   │   ├── metrics.go            # Prometheus 指标暴露
│   │   │   └── proxy.go              # 核心代理 + SSE 流处理
│   │   ├── middleware/auth.go        # API Key 鉴权中间件
│   │   ├── model/types.go            # 数据模型定义
│   │   ├── pool/
│   │   │   ├── circuit_breaker.go    # 三态熔断器
│   │   │   └── pool.go               # 渠道池 + 原子并发
│   │   ├── ratelimit/token_bucket.go # 多级限流 (Lua 原子)
│   │   └── tokenizer/tokenizer.go    # tiktoken 分词器
│   ├── migrations/
│   │   ├── 001_init.up.sql           # 初始化 Schema
│   │   └── 001_init.down.sql         # 回滚
│   ├── Dockerfile                    # 多架构构建
│   ├── .dockerignore
│   └── go.mod
│
├── frontend/                         # Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing Page
│   │   │   ├── login/page.tsx        # 邮箱验证码登录
│   │   │   ├── dashboard/page.tsx    # 用户中台
│   │   │   ├── admin/page.tsx        # 管理后台 (5 Tab)
│   │   │   └── api/                  # 14 个 API Route
│   │   │       ├── auth/             # send-code, verify-code, me, logout
│   │   │       ├── dashboard/usage/  # 使用统计
│   │   │       ├── keys/             # API Key CRUD
│   │   │       ├── admin/            # users, channels, pricing, billing, stats
│   │   │       └── billing/          # checkout, webhook
│   │   ├── components/
│   │   │   ├── landing/              # Hero Particles 动画
│   │   │   ├── dashboard/            # Token/Cost Charts
│   │   │   └── ui/                   # Badge, DataTable, Skeleton
│   │   ├── hooks/use-auth.ts         # Auth React Hook
│   │   ├── lib/
│   │   │   ├── api.ts                # API Client
│   │   │   ├── auth.ts               # JWT 签发/验证
│   │   │   ├── db.ts                 # PostgreSQL 连接池
│   │   │   ├── email.ts              # SMTP 邮件服务
│   │   │   ├── redis.ts              # Redis 客户端
│   │   │   └── utils.ts              # 工具函数
│   │   ├── middleware.ts             # Edge Middleware (路由保护)
│   │   └── types/index.ts            # TypeScript 类型
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── tailwind.config.ts
│   └── package.json
│
├── config/
│   └── Caddyfile                     # 自动 HTTPS + 反向代理
├── scripts/
│   └── deploy.sh                     # 生产部署脚本 (蓝绿/回滚/备份)
├── docs/
│   ├── REDIS_SCHEMA.md               # Redis 缓存设计
│   └── ARCHITECTURE.md               # 本文档
├── .github/workflows/ci-cd.yml       # GitHub Actions CI/CD
├── docker-compose.production.yml     # 生产环境编排
├── docker-compose.dev.yml            # 本地开发环境
├── Makefile                          # 开发/构建/部署命令
├── .env.example                      # 环境变量模板
└── .gitignore
```

---

## 3. 数据库设计

### 3.1 实体关系图 (核心表)

```
users (用户)                        channels (上游渠道池)
├── id: UUID PK                    ├── id: UUID PK
├── email: VARCHAR UNIQUE          ├── name: VARCHAR
├── password_hash: VARCHAR         ├── provider: ENUM(openai,azure,...)
├── role: ENUM(user,admin)         ├── api_key_enc: TEXT (AES-256-GCM)
├── status: ENUM(active,disabled)  ├── base_url: TEXT
├── balance_cents: BIGINT          ├── models: TEXT[]
├── subscription_tier: ENUM        ├── weight: INT (负载权重)
├── daily_token_quota: INT         ├── priority: INT (优先级)
├── daily_token_used: INT          ├── max_concurrency: INT
└── created_at: TIMESTAMPTZ        ├── status: ENUM(active,disabled,...)
                                   ├── error_count: INT
api_keys                           └── cost_multiplier: REAL
├── id: UUID PK
├── user_id: FK → users            model_pricing (模型定价)
├── key_hash: VARCHAR UNIQUE       ├── id: UUID PK
├── key_prefix: VARCHAR (显示前缀) ├── model_name: VARCHAR UNIQUE
├── name: VARCHAR                  ├── sell_input_price: REAL ($/1K)
├── is_enabled: BOOLEAN            ├── sell_output_price: REAL
├── rpm_limit: INT (NULL=默认)     ├── cost_input_price: REAL
├── tpm_limit: INT                 ├── vip_discount: REAL (默认 0.9)
└── last_used_at: TIMESTAMPTZ      └── enterprise_discount: REAL

billing_records (计费流水)          subscription_plans (订阅计划)
├── id: BIGSERIAL PK               ├── id: UUID PK
├── user_id: FK → users            ├── tier: ENUM(free,vip,enterprise) UNIQUE
├── api_key_id: FK → api_keys      ├── price_monthly_cents: INT
├── channel_id: FK → channels      ├── price_yearly_cents: INT
├── model_name: VARCHAR            ├── daily_token_quota: INT
├── prompt_tokens: INT             ├── rpm_limit: INT
├── completion_tokens: INT         └── features: JSONB
├── total_tokens: INT
├── cost_cents: BIGINT             verification_codes (邮箱验证码)
├── balance_after: BIGINT          ├── id: UUID PK
├── pricing_id: FK → model_pricing ├── email: VARCHAR
├── status: VARCHAR                ├── code: VARCHAR(6)
└── created_at: TIMESTAMPTZ        ├── purpose: VARCHAR (login/register)
    (索引: user_id + created_at)   ├── used: BOOLEAN
                                   ├── expires_at: TIMESTAMPTZ
audit_logs (管理审计)              └── created_at: TIMESTAMPTZ
├── id: BIGSERIAL PK
├── admin_id: FK → users
├── action: VARCHAR
├── target_type: VARCHAR
├── target_id: VARCHAR
├── detail: JSONB
└── created_at: TIMESTAMPTZ
```

### 3.2 关键设计决策

**余额用 BIGINT 存储美分**
- 避免浮点数精度问题 (0.1 + 0.2 ≠ 0.3)
- 1 美元 = 100 cents，存储为整数
- 最小计费单位 1 cent

**API Key 存储 SHA-256 哈希**
- 原始 key 仅在创建时返回一次（类似 GitHub PAT）
- 数据库仅存哈希，泄露数据库也无法还原 key
- API 调用方使用 `Authorization: Bearer sk-{raw_key}`

**billing_records 是不可变账本**
- 插入后永不移除
- 存储 `balance_after` 字段实现审计追溯
- 生产环境建议按月份分区

**渠道 API Key 使用 AES-256-GCM 加密存储**
- 加密密钥通过环境变量注入
- 服务启动时解密到内存，运行时以明文在内存中
- 防止数据库文件泄露导致上游 API Key 泄露

---

## 4. Redis 缓存架构

### 4.1 Key 设计总表

| Redis Key Pattern | 类型 | TTL | 用途 |
|------------------|------|-----|------|
| `apikey:{sha256}` | Hash | 5 min | API Key → user_id, tier, rpm/tpm limit |
| `channel:{id}:concurrency` | String (counter) | 2 min | 渠道当前并发数 (原子 INCR/DECR) |
| `channel:{id}` | Hash | 持久 | 渠道健康状态 (breaker_state, error_count) |
| `ratelimit:rpm:{user_id}` | Sorted Set | 60s | 滑动窗口 RPM 限流 |
| `ratelimit:tpm:{user_id}` | String (counter) | 60s | 当前分钟 Token 计数 |
| `ratelimit:concurrent:{user_id}` | String (counter) | 120s | 用户并发请求计数 |
| `ratelimit:ip:{ip}` | Sorted Set | 60s | IP 级别 RPM 限流 |
| `user:{id}:daily_tokens` | String (counter) | 到 UTC 午夜 | 当日 Token 使用量 |
| `user:{id}` | Hash | 10 min | 用户余额/配额热缓存 |
| `pricing:models` | String (JSON) | 5 min | 定价表全量缓存 (跨实例共享) |
| `quota:reset:{user_id}:{YYYY-MM-DD}` | String | 24h | 当日配额上限 |

### 4.2 热路径优化

**鉴权热路径 (每次 API 请求):**
```
Client → Redis HGETALL apikey:{hash} → (命中率 >99%) → 直接注入 Locals
                                     → (未命中) → PostgreSQL → HSET + EXPIRE 5min
```
- Redis 耗时: < 1ms
- PostgreSQL 耗时: ~5ms (仅缓存未命中时)

**限流热路径:**
- RPM: Lua 脚本 `ZREMRANGEBYSCORE + ZCARD + ZADD` 原子执行
- TPM: INCRBY + EXPIRE pipeline，2 次网络往返
- 并发: INCR + 溢出回滚 DECR

**渠道并发热路径:**
- `INCR channel:{id}:concurrency` → 比较 maxConcurrency → 超限则 DECR 回滚
- 跨多网关实例共享，保证并发数全局一致

### 4.3 限流算法

**滑动窗口 (RPM / IP):**
```
Lua 原子操作:
1. ZREMRANGEBYSCORE key 0 {window_start}   // 清理过期条目
2. ZCARD key                               // 当前窗口内请求数
3. if count < limit:
     ZADD key {now} {now}-{random}         // 添加新条目
     EXPIRE key {window_seconds + 1}
     return ALLOWED
   else:
     return DENIED + retry_after seconds
```

**令牌桶 (VIP/Enterprise 突发):**
```
Lua 原子操作:
1. tokens = HGET key 'tokens' or burst
2. elapsed = now - last_refill
3. tokens = min(burst, tokens + elapsed * refill_rate)
4. if tokens >= 1:
     tokens -= 1; return ALLOWED
   else:
     return DENIED + wait_ms
```

---

## 5. 核心网关引擎

### 5.1 渠道池 (Channel Pool)

**Channel 数据结构:**
```go
type Channel struct {
    ID               string
    Name             string
    Provider         string        // openai, azure, anthropic, etc.
    APIKey           string        // 解密后的明文 (仅内存)
    BaseURL          string
    Models           []string      // 支持的模型列表
    Weight           int           // 负载权重 (越高分配越多)
    Priority         int           // 优先级 (越高优先使用)
    MaxConcurrency   int           // 最大并发连接数
    breaker          *CircuitBreaker // 熔断器实例
    httpClient       *http.Client  // 连接池复用
}
```

**渠道选择算法 (三级排序):**
```
1. Priority DESC     → 高优先级渠道优先
2. AvailableCapacity DESC → (maxConcurrency - currentConcurrency) 大的优先 (最少连接)
3. Weight DESC       → 同优先级同容量下，高权重优先
```

**原子并发获取:**
```go
func AcquireChannel(ctx, model) (*Channel, error) {
    snapshots := buildSnapshots(model)  // 读取快照
    sortSnapshots(snapshots)            // 三级排序

    for _, snap := range snapshots {
        if breaker.State == CircuitOpen { continue }
        if snap.Concurrency >= snap.MaxConcurrency { continue }

        // Redis 原子 INCR
        newVal := rdb.Incr(ctx, "channel:{id}:concurrency")
        if newVal > snap.MaxConcurrency {
            rdb.Decr(ctx, key) // 溢出回滚
            continue
        }
        return channel, nil
    }
    return nil, "all channels exhausted"
}
```

### 5.2 熔断器 (Circuit Breaker)

**三态有限状态机:**

```
                    ┌──────────────────────────────────┐
                    │                                  │
                    ▼                                  │
              ┌──────────┐    failures >= threshold    │
              │  CLOSED   │─────────────────────────┐  │
              │ (normal)  │                         │  │
              └──────────┘                         ▼  │
                    │                      ┌──────────────┐
                    │ success              │     OPEN      │
                    │ reset                │ (reject all)  │
                    │                      └──────┬───────┘
                    │                             │
                    │                  cooldown elapsed
                    │                             │
                    │                             ▼
                    │                    ┌──────────────────┐
                    └────────────────────│   HALF-OPEN      │
                          2 consecutive  │ (probe requests) │
                          successes      └──────────────────┘
```

**差异化熔断策略:**

| HTTP 状态码 | 动作 | 冷却时间 | 理由 |
|-----------|------|---------|------|
| 401 / 403 | 立即 Open | 5 分钟 | 认证失败=Token 已死, 无需重试 |
| 429 | 立即 Open | 15 秒 | 上游限流, 短暂等待即可恢复 |
| 5xx | 阈值: 连续 5 次 | 指数退避 30s→60s→120s→5min | 可能瞬态故障, 逐级放大等待 |

**Half-Open 探测:**
- 最多允许 2 个并行探测请求
- 需要连续 2 次成功才恢复 Closed
- 探测失败则重新进入 Open 状态

### 5.3 重试与退避

```
executeWithRetry(model, bodyBytes, stream):
  for attempt := 0..3:
    channel := pool.AcquireChannel(model)
    resp := channel.httpClient.Do(upstreamRequest)

    if resp.StatusCode in {429, 401, 403, 502, 503, 504}:
      pool.RecordError(channel, statusCode)   // 触发熔断器
      pool.ReleaseChannel(channel)             // 释放并发槽位
      sleep(baseBackoff * 2^attempt)           // 200ms → 400ms → 800ms
      continue                                  // 重新选择渠道

    return resp  // 成功或非可重试错误
```

### 5.4 SSE 流处理

**核心流程:**
```go
func proxySSE(c, resp, deps) {
    c.Set("Content-Type", "text/event-stream")
    c.Set("Cache-Control", "no-cache, no-transform")
    c.Set("X-Accel-Buffering", "no")  // 禁用 Nginx 缓冲

    c.BodyStreamWriter(func(w *bufio.Writer) {
        reader := bufio.NewReader(resp.Body)
        for {
            select {
            case <-c.Context().Done():
                return  // 客户端断开, 立即停止
            default:
            }

            line := reader.ReadString('\n')
            if strings.HasPrefix(line, "data: ") {
                data := strings.TrimPrefix(line, "data: ")
                if data == "[DONE]" {
                    w.WriteString("data: [DONE]\n\n")
                    w.Flush()
                    break
                }
                // 解析 usage chunk 获取 token 计数
                json.Unmarshal(data, &chunk)
                if chunk["usage"] != nil {
                    completionTokens = chunk["usage"]["completion_tokens"]
                }
            }
            w.WriteString(line)
            w.Flush()  // 每次立即 flush，零缓冲
        }
    })

    // 流结束后异步计费
    go func() {
        <-streamComplete
        deps.Billing.Enqueue(BillingTask{...})
    }()
}
```

---

## 6. 计费引擎

### 6.1 tiktoken 精确分词

**GPT-4/GPT-4o 使用的 cl100k_base 编码:**
```
Tokenizer.CountMessagesTokens(encoding, messages):
  for each message:
    total += 3  (base overhead per message)

    // Role field
    total += CountTokens(encoding, message.role)

    // Content: 区分纯文本和多模态
    if message.content is string:
      total += CountTokens(encoding, string)
    elif message.content is array:  // 多模态
      for each part:
        if part["type"] == "text":
          total += CountTokens(encoding, part["text"])
        elif part["type"] == "image_url":
          total += 85   (低分辨率图片)
          if detail == "high": total += 170

  total += 3  (assistant reply primer)

CountTokens(encoding, text):
  // BPE 启发式分词:
  // 短词 <=4 chars: 1 token
  // 中词 5-8 chars: 2 tokens
  // 长词 9-12 chars: 3 tokens
  // 超长词: chars/4 + 1 tokens
  // CJK字符: 每字 2 tokens
  准确率 ≈95% (vs 完整 tiktoken 库)
```

**响应计费 — 从 API 响应提取精确 token 数:**
```go
func ParseResponseUsage(body []byte) (promptTokens, completionTokens int) {
    // 直接解析 OpenAI API 响应中的 usage 字段
    // {
    //   "usage": {
    //     "prompt_tokens": 150,
    //     "completion_tokens": 80,
    //     "total_tokens": 230
    //   }
    // }
    json.Unmarshal(body, &resp)
    return resp.Usage.PromptTokens, resp.Usage.CompletionTokens
}
```

**计费公式:**
```
cost_cents = (prompt_tokens / 1000 * sell_input_price * 100)
           + (completion_tokens / 1000 * sell_output_price * 100)

if tier == "vip":       cost_cents *= 0.9
if tier == "enterprise": cost_cents *= 0.8

最终 cost_cents 最小值为 1 cent
```

### 6.2 定价引擎 (三级缓存)

```
CalculateCost(model, promptTokens, completionTokens, tier):
    │
    ▼
  [L1] sync.RWMutex map[string]*ModelPrice    ← 内存 (零锁读)
    │ miss
    ▼
  [L2] Redis GET pricing:models               ← 5min TTL, 跨实例
    │ miss
    ▼
  [L3] PostgreSQL model_pricing                ← DB查询
    │
    ▼
  计算: inputPrice * promptTokens/1000 + outputPrice * completionTokens/1000
  应用 tier discount
  返回 cost_cents
```

### 6.3 异步 Worker Pool

```
Producer (HTTP handler, ~10K QPS)
    │ Enqueue(BillingTask)  // 非阻塞
    ▼
buffered channel [10,000] ───────────────────────────┐
                                                      │
  Worker-1 ◄── task ──► local buffer [200] ◄──┐       │
  Worker-2 ◄── task ──► local buffer [200] ◄──┤       │
                                              │       │
  1s ticker ──────────► drainBuffer() ◄────────┘       │
  200 full trigger ───►                                        │
                                                      │
  drainBuffer:                                        │
    1. swap buffer (lock)                             │
    2. BEGIN transaction                              │
    3. for each task:                                 │
         UPDATE users SET balance -= cost             │
         INSERT INTO billing_records                  │
    4. COMMIT                                         │
    5. Redis INCRBY user:{id}:daily_tokens (pipeline) │
                                                      │
  Overflow safety:                                    │
    channel full → writeDirect() (blocking fallback)  │
    batch tx fail → writeDirectBatch() (row-by-row)  │
```

**性能特性:**
- 正常路径: 异步非阻塞，HTTP 响应不受计费写入影响
- 批量写入: 200 条/tx，减少 PostgreSQL 往返
- 故障安全: 三层回退 (channel → direct → row-by-row)

### 6.4 用户余额与配额

**日配额检查 (Free tier):**
```
CheckDailyQuota(userID):
  quota = Redis GET quota:reset:{userID}:{today} OR DB
  used  = Redis GET user:{userID}:daily_tokens OR DB

  if used >= quota:
    return DENIED, "resets at midnight UTC"
  return ALLOWED
```

**余额检查:**
```
CheckBalance(userID, estimatedCost):
  if tier != "free": return ALLOWED  // VIP/Enterprise 允许透支
  balance = DB query "SELECT balance_cents FROM users"
  if balance < estimatedCost:
    return DENIED, "402 Payment Required"
  return ALLOWED
```

---

## 7. 前端与用户中台

### 7.1 页面结构

```
Landing Page (/)
├── Hero Section: Canvas粒子动画 + 渐变文字
├── Features Grid: 6个核心能力卡片
├── CTA Section: 注册引导
└── Footer

登录/注册 (/login)
├── Step 1: 输入邮箱 → 发送验证码
├── Step 2: 输入6位验证码 → 自动注册新用户
└── 支持 ?redirect= 参数

用户中台 (/dashboard)
├── Usage Tab
│   ├── 统计卡片: 总Token / 请求数 / 费用 / 平均Token
│   ├── Token消耗趋势图 (Area Chart)
│   ├── 费用柱状图 (Bar Chart)
│   └── 7天/30天切换
├── Keys Tab
│   ├── 创建 API Key (输入名称 → 一次性显示完整Key)
│   ├── Key 列表 (名称 / 前缀 / 最后使用时间)
│   └── 删除确认

管理后台 (/admin)
├── Overview: 4个统计卡片 + 系统状态
├── Users: 分页表格 + 搜索 + 启用/禁用
├── Channels: CRUD表单 + AES-256加密存储
├── Pricing: 模型定价配置 + 利润率自动计算
└── Billing: 分页计费流水
```

### 7.2 响应式断点

| 断点 | 宽度 | 布局策略 |
|------|------|---------|
| Mobile | < 768px | 单列, 隐藏侧栏, 底部导航 |
| Tablet | 768-1024px | 双列卡片, 侧栏收缩 |
| Desktop | > 1024px | 完整布局, 固定侧栏 |

### 7.3 状态覆盖

每个数据组件覆盖四种状态：

| 状态 | UI 表现 |
|------|--------|
| Loading | Skeleton 骨架屏 (匹配目标组件的形状) |
| Empty | 图标 + 引导文案 + 操作入口 |
| Error | 红色错误信息 + 重试按钮 |
| Data | 正常渲染数据 |

### 7.4 Next.js API 路由表

| 端点 | 方法 | 鉴权 | 功能 |
|------|------|------|------|
| `/api/auth/send-code` | POST | 无 | 发送邮箱验证码 |
| `/api/auth/verify-code` | POST | 无 | 验证码校验 + 自动注册 + 签发JWT |
| `/api/auth/me` | GET | JWT Cookie | 当前用户信息 |
| `/api/auth/logout` | POST | JWT Cookie | 清除Cookie |
| `/api/dashboard/usage` | GET | JWT Cookie | Token消耗/费用/请求数 按日聚合 |
| `/api/keys` | GET | JWT Cookie | API Key列表 |
| `/api/keys` | POST | JWT Cookie | 创建API Key + 同步Redis |
| `/api/keys/[id]` | DELETE | JWT Cookie | 删除Key (仅限本人) |
| `/api/admin/stats` | GET | JWT + admin | 系统统计 |
| `/api/admin/users` | GET/PATCH | JWT + admin | 用户管理 |
| `/api/admin/channels` | GET/POST/DELETE | JWT + admin | 渠道池管理 |
| `/api/admin/pricing` | GET/POST/PATCH | JWT + admin | 定价管理 |
| `/api/admin/billing` | GET | JWT + admin | 计费流水 |
| `/api/billing/checkout` | POST | JWT Cookie | 订阅/充值 |
| `/api/billing/webhook` | POST | 签名验证 | Stripe Webhook |

### 7.5 鉴权流程

**Edge Middleware (路由保护):**
```typescript
// src/middleware.ts — 在每个请求前运行

middleware(req):
  if pathname in ["/dashboard", "/admin"]:
    token = req.cookies.get("llmgw_token")
    if !token: redirect to /login?redirect={pathname}

    payload = jwtVerify(token, JWT_SECRET)

    if pathname.startsWith("/admin") and payload.role != "admin":
      redirect to /dashboard

  return NextResponse.next()
```

**JWT 配置:**
- 算法: HS256
- 过期: 7 天
- 存储: httpOnly Cookie (防 XSS), Secure (生产环境), SameSite=Lax
- Payload: `{ sub: user_id, email, role, tier }`

---

## 8. 管理后台

### 8.1 用户管理

- 分页用户列表 (20条/页)
- 邮箱搜索
- 启用/禁用账户切换
- 角色标签 (user/admin)
- 订阅计划标签 (free/vip/enterprise)
- 余额显示

### 8.2 渠道池管理

- 创建渠道表单:
  - Provider 下拉选择 (openai/azure/anthropic/google/deepseek/custom)
  - API Key 输入 → AES-256-GCM 加密存储
  - Base URL
  - 模型列表 (逗号分隔)
  - 权重/优先级/最大并发数
- 渠道列表: 状态标签 (active/rate_limited/error/disabled)
- 删除渠道

### 8.3 定价管理

- 模型定价 CRUD (支持 upsert)
- 售价 vs 成本价对比
- VIP/Enterprise 折扣配置
- 自动利润率计算: `(sell - cost) / cost * 100%`
- 启用/禁用切换

### 8.4 计费流水

- 分页查询 (20条/页)
- 字段: 时间 / 用户邮箱 / 模型 / Token数 / 费用 / 余额 / 状态
- 支持按 user_id 过滤

---

## 9. 支付抽象层

### 9.1 接口设计

```go
type Provider interface {
    CreateCheckout(ctx, CheckoutRequest) (*CheckoutResult, error)
    VerifyWebhook(ctx, payload, signature) (*WebhookEvent, error)
    GetSubscription(ctx, subscriptionID) (*Subscription, error)
    CancelSubscription(ctx, subscriptionID) error
    Name() string
}
```

### 9.2 当前实现

**Stripe (`internal/billing/payment/stripe.go`):**
- Stub 模式: 未配置 API Key 时返回模拟响应
- 生产模式: 替换为 `stripe-go` SDK 调用即可
- Webhook 处理: `checkout.session.completed` → 激活订阅, `customer.subscription.deleted` → 降级

**预留扩展:**
- 实现 `Provider` 接口即可添加 Alipay / WeChat Pay / PayPal
- 通过环境变量切换: `PAYMENT_PROVIDER=stripe|alipay|wechat`

### 9.3 Webhook 事件流转

```
Stripe Dashboard
    │  webhook event
    ▼
POST /api/billing/webhook
    │  VerifyWebhook(payload, stripe-signature)
    ▼
switch event.Type:
  case "checkout.session.completed":
    UPDATE users SET subscription_tier = metadata.plan_tier
    UPDATE users SET balance_cents += amount_total
    UPDATE users SET daily_token_quota = corresponding_quota

  case "customer.subscription.deleted":
    UPDATE users SET subscription_tier = 'free'
    UPDATE users SET daily_token_quota = 10000
```

---

## 10. 安全设计

### 10.1 分层安全策略

| 层 | 安全措施 |
|---|---------|
| 传输层 | TLS 1.3 (Caddy 自动), HSTS |
| 应用层入口 | 全局连接限制 (10k), CORS 白名单 |
| 认证 | API Key SHA-256 哈希, JWT HS256, httpOnly Secure Cookie |
| 授权 | Middleware 角色检查 (user/admin), API Key 归属校验 |
| 数据存储 | Channel API Key AES-256-GCM, 用户密码 (预留bcrypt) |
| 通信 | Security Headers: X-Content-Type-Options, X-Frame-Options, CSP |
| 审计 | audit_logs 表记录所有管理操作 |

### 10.2 API Key 生命周期

```
创建:
  1. 前端 POST /api/keys {name: "Production"}
  2. 后端生成 sk-{48位随机hex}
  3. SHA-256(raw) → key_hash 存入 PostgreSQL
  4. prefix = 前12字符 → 存入 key_prefix
  5. 返回完整的 sk-xxx 给用户 (仅此一次!)
  6. Redis HSET apikey:{hash} user_id, tier (5min TTL)

使用:
  1. 客户端发送 Authorization: Bearer sk-xxx
  2. 网关 SHA-256(raw_key) → 查询 Redis apikey:{hash}
  3. 获取 user_id, tier, limits
  4. 异步更新 last_used_at

吊销:
  1. DELETE /api/keys/{id}
  2. 删除 PostgreSQL 记录
  3. Redis key 将在 5min 后自然过期
```

### 10.3 密钥轮换建议

- JWT_SECRET: 每季度轮换 (旧 token 在 7 天内自然过期)
- ENCRYPTION_KEY: 不允许轮换 (否则存量 Channel API Key 无法解密)
- 数据库密码: 每季度轮换
- Redis 密码: 每季度轮换

---

## 11. 可观测性

### 11.1 Prometheus 指标

```
GET /metrics (无需认证)

llmgw_requests_total              总请求数
llmgw_requests_successful_total   成功响应数
llmgw_requests_failed_total       失败响应数
llmgw_rate_limited_total          被限流数
llmgw_sse_streams_active          活跃 SSE 连接数
llmgw_tokens_processed_total      Token 处理总量
llmgw_billing_events_sent_total   计费事件入队数
```

### 11.2 日志规范

**结构化日志格式 (Gateway):**
```
[请求ID] 模型 渠道 -> 供应商 耗时 prompt=xxx completion=xxx
```

示例:
```
[a3f2b1c4] gpt-4o-mini OpenAI-Prod-1 -> openai 234ms prompt=150 completion=80
[a3f2b1c4] SSE complete: prompt=150 completion=80 total=230
Billing: user=xxx model=gpt-4o-mini tokens=230 cost=1¢ balance=9999¢
```

**Caddy 日志:**
- JSON 格式输出到 stdout
- 包含: 时间戳、请求方法、状态码、耗时、User Agent

### 11.3 健康检查端点

```
GET /health
  → {"status": "ok", "time": 1716096000}
  用途: 负载均衡器存活检查

GET /health/ready
  → {"status": "ready", "postgres": "connected", "redis": "connected"}
  用途: Kubernetes readiness probe
  检查: PostgreSQL ping + Redis ping
```

### 11.4 告警建议

配置 Prometheus + Grafana 告警规则:

| 指标 | 条件 | 严重性 |
|------|------|--------|
| `llmgw_requests_failed_total` | 5分钟增速 > 50 | Warning |
| `llmgw_rate_limited_total` | 5分钟增速 > 100 | Warning |
| `llmgw_sse_streams_active` | > 1000 | Info |
| PostgreSQL 连接数 | > 80% max_connections | Critical |
| Redis 内存 | > 80% maxmemory | Warning |
| Caddy SSL 证书到期 | < 7 天 | Critical |
| 磁盘使用率 | > 85% | Warning |

---

## 12. 生产部署指南

### 12.1 服务器要求

| 资源 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4 GB |
| 磁盘 | 20 GB SSD | 40 GB SSD |
| 系统 | Ubuntu 20.04/22.04/24.04 LTS | Ubuntu 24.04 LTS |
| 网络 | 公网 IP + 开放 80/443 端口 | 独立域名 + DNS 解析 |

### 12.2 部署步骤 (Ubuntu 云服务器)

#### Step 1: 连接服务器

```bash
ssh ubuntu@your-server-ip
```

#### Step 2: 安装 Docker

```bash
# 卸载旧版本 (如有)
sudo apt-get remove docker docker-engine docker.io containerd runc

# 安装依赖
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加 Docker 稳定版仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

# 添加当前用户到 docker 组 (免 sudo)
sudo usermod -aG docker $USER

# 激活组变更
newgrp docker

# 验证安装
docker --version
docker compose version
```

#### Step 3: 配置 DNS 解析

在你的域名 DNS 管理面板中添加两条 A 记录:

```
类型    主机记录    记录值
A       @          你的服务器公网IP
A       api        你的服务器公网IP
```

验证 DNS 生效:
```bash
# 等待 DNS 传播 (1-10分钟)
nslookup yourdomain.com
nslookup api.yourdomain.com
```

#### Step 4: 克隆项目

```bash
# 从你的 Git 仓库克隆
cd /opt
git clone https://github.com/your-org/llm-gateway.git llmgateway
cd llmgateway
```

如果还没有推送到 GitHub，使用 rsync 上传:
```bash
# 在本地 Windows 上 (PowerShell):
rsync -avz --exclude '.git' --exclude 'node_modules' \
    F:/code/agent/ ubuntu@your-server-ip:/opt/llmgateway/
```

#### Step 5: 配置环境变量

```bash
cd /opt/llmgateway

# 复制模板
cp .env.example .env

# 编辑配置
nano .env
```

**必须修改的值:**
```ini
DOMAIN=yourdomain.com
API_DOMAIN=api.yourdomain.com
ACME_EMAIL=your-email@example.com

DB_PASSWORD=<生成强密码: openssl rand -hex 16>
JWT_SECRET=<生成: openssl rand -hex 32>
ENCRYPTION_KEY=<生成: openssl rand -hex 16>

# 如果配置了 SMTP (可选, 否则验证码打印到日志)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@yourdomain.com

# Stripe (可选, 否则使用 stub)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

#### Step 6: 启动服务

```bash
# 构建并启动所有服务
docker compose -f docker-compose.production.yml up -d --build

# 或者使用 Makefile
make deploy
```

**首次构建需要 3-8 分钟** (下载镜像 + 编译 Go + npm install + 构建 Next.js)。

**查看启动日志:**
```bash
docker compose -f docker-compose.production.yml logs -f
```

#### Step 7: 验证部署

```bash
# 检查所有容器状态
docker compose -f docker-compose.production.yml ps

# 期望输出:
# NAME                       STATUS
# llmgateway-caddy-1         Up (healthy)
# llmgateway-gateway-1       Up (healthy)
# llmgateway-frontend-1      Up (healthy)
# llmgateway-postgres-1      Up (healthy)
# llmgateway-redis-1         Up (healthy)
```

**健康检查:**
```bash
# 网关健康检查
curl https://yourdomain.com/health
# → {"status":"ok","time":1716096000}

# 就绪检查
curl https://yourdomain.com/health/ready
# → {"status":"ready","postgres":"connected","redis":"connected"}

# 前端页面
curl -I https://yourdomain.com/
# → HTTP/2 200

# API 端点
curl https://api.yourdomain.com/v1/models
# → {"object":"list","data":[...]}
```

#### Step 8: 访问你的应用

- **前台 (Landing Page)**: https://yourdomain.com
- **API 端点**: https://api.yourdomain.com/v1/chat/completions
- **管理后台**: https://yourdomain.com/admin
- **Prometheus 指标**: https://yourdomain.com/metrics

#### Step 9: 创建管理员账户

```bash
# 首先通过前台注册一个账户:
# 访问 https://yourdomain.com/login
# 输入邮箱 → 接收验证码 → 自动创建账户

# 然后将该用户提升为管理员:
docker compose -f docker-compose.production.yml exec -T postgres \
    psql -U llmgateway -d llmgateway -c \
    "UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';"

# 验证:
docker compose -f docker-compose.production.yml exec -T postgres \
    psql -U llmgateway -d llmgateway -c \
    "SELECT email, role FROM users;"
```

#### Step 10: 添加上游渠道

登录管理后台 → Channels → Add Channel:

```
Name:         OpenAI-Production
Provider:     openai
API Key:      sk-proj-xxxxxxxxxxxxx
Base URL:     https://api.openai.com
Models:       gpt-4o-mini,gpt-4o,gpt-4o-2024-08-06
Weight:       1
Priority:     0
Max Concurrency: 10
```

#### Step 11: 测试 API 调用

```bash
# 1. 在前台 Dashboard → API Keys → 创建一个 Key

# 2. 使用创建的 Key 测试:
curl https://api.yourdomain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# 3. 测试流式:
curl -N https://api.yourdomain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'
```

### 12.3 常用运维命令

```bash
# === 查看状态 ===
make status                                  # 服务状态
make deploy-logs SVC=gateway                # 网关日志
docker stats                                 # 资源使用

# === 更新部署 ===
git pull                                     # 拉取最新代码
make deploy                                  # 蓝绿零停机部署

# === 回滚 ===
./scripts/deploy.sh rollback

# === 备份 ===
make db-backup                               # 备份到 backups/
ls backups/                                  # 查看备份文件

# === 扩容 ===
GATEWAY_REPLICAS=4 docker compose up -d --scale gateway=4

# === 重启单个服务 ===
docker compose restart gateway

# === 完全停止 ===
make deploy-stop

# === 完全清理 ===
docker compose down -v                       # 删除所有数据卷!
```

### 12.4 防火墙配置

```bash
# Ubuntu UFW
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (Caddy 重定向到 HTTPS)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable

# 禁止直接访问数据库端口
# 5432 (PostgreSQL) 和 6379 (Redis) 不应对外开放
# docker-compose 中已配置 backend 网络为 internal: true
```

### 12.5 SSL 证书

Caddy 自动通过 Let's Encrypt 申请和续期 SSL 证书:

- 首次启动: 自动申请 (需要 30-60 秒)
- 自动续期: 证书到期前 30 天自动续期
- 存储位置: `caddy_data` Docker volume
- 前提条件: 域名必须正确解析到服务器 IP, 80/443 端口必须对外开放

```bash
# 检查证书状态
docker compose logs caddy | grep -i certificate

# 强制续期
docker compose exec caddy caddy reload
```

### 12.6 监控配置 (可选)

```bash
# 添加 Prometheus scrape 配置:
# prometheus.yml
scrape_configs:
  - job_name: 'llmgateway'
    scrape_interval: 15s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['yourdomain.com:443']
        scheme: https
```

### 12.7 性能调优

**网关并发:**
```ini
# .env
GATEWAY_REPLICAS=4      # 多实例水平扩展
```

**PostgreSQL 连接池:**
```go
// gateway/internal/config/config.go
// 默认: MaxConns=50, MinConns=5
// 高负载: MaxConns=100
```

**Redis 内存:**
```yaml
# docker-compose.production.yml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

**系统限制:**
```bash
# /etc/sysctl.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
fs.file-max = 1000000
```

### 12.8 故障排除

| 问题 | 检查步骤 |
|------|---------|
| 无法访问 | `docker compose ps` 检查所有服务状态; `docker compose logs caddy` 检查 SSL 证书 |
| 数据库错误 | `docker compose logs postgres`; 检查磁盘空间 `df -h` |
| API 返回 502 | `docker compose logs gateway`; 检查上游 API Key 是否有效 |
| 限流过多 | 检查 Dashboard 中的 Token 使用量; 调整 `rpm_limit` |
| 内存不足 | `docker stats`; 降低 `GATEWAY_REPLICAS`; 增加 swap |
| SSL 过期 | `docker compose logs caddy \| grep certificate`; Caddy 自动续期 |

---

## 附录

### A. 默认账号

| 角色 | 创建方式 |
|------|---------|
| 普通用户 | 前台 https://yourdomain.com/login 输入邮箱自动注册 |
| 管理员 | 注册后通过 SQL 提升: `UPDATE users SET role='admin' WHERE email='...'` |

### B. 默认订阅计划

| 计划 | 月费 | 日Token配额 | RPM限制 | 模型权限 |
|------|------|-----------|--------|---------|
| Free | $0 | 10,000 | 10 | gpt-4o-mini |
| VIP | $19.99 | 100,000 | 60 | +gpt-4o, claude-4-haiku |
| Enterprise | $99.99 | 1,000,000 | 300 | 全部模型 |

### C. 默认模型定价

| 模型 | 输入售价 ($/1K) | 输出售价 ($/1K) | 成本价 ($/1K In) |
|------|---------------|----------------|-----------------|
| gpt-4o-mini | $0.20 | $0.80 | $0.15 |
| gpt-4o | $3.50 | $14.00 | $2.50 |
| claude-4-haiku | $1.50 | $7.50 | $1.00 |

### D. API 兼容性

完全兼容 OpenAI SDK 客户端:

```python
# Python
from openai import OpenAI
client = OpenAI(
    base_url="https://api.yourdomain.com/v1",
    api_key="sk-your-gateway-key"
)
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

```javascript
// Node.js
import OpenAI from 'openai';
const openai = new OpenAI({
  baseURL: 'https://api.yourdomain.com/v1',
  apiKey: 'sk-your-gateway-key',
});
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

---

> **文档版本**: v2.0 | **最后更新**: 2026-05-20 | **项目总代码量**: ~6,842 行
