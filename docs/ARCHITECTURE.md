# Camellia — 山茶花大模型 API 调度平台

## 完整架构文档 · Claude Code 接手即用

---

## 1. 项目概述

**Camellia**（山茶花）是一套企业级大模型 API 统一调度网关与商业化分发平台。用 Go Fiber 构建高性能网关层，Next.js 14 构建前端中台，PostgreSQL + Redis 做数据持久化和缓存。

### 1.1 核心能力

| 能力 | 实现 |
|------|------|
| 协议兼容 | 完全兼容 OpenAI `/v1/chat/completions`、`/v1/embeddings`、`/v1/models` |
| 流式支持 | SSE 实时流式转发，零缓冲延迟 |
| 渠道池 | 权重+优先级+最少连接三级排序，Redis 原子并发计数 |
| 熔断保护 | 三态熔断器 Closed→Open→Half-Open，按错误码差异化冷却 |
| 计费引擎 | tiktoken 分词，输入/输出分别定价，异步 Worker Pool 批量写入 |
| 限流控制 | IP→RPM→并发数→TPM 五级限流，Redis Lua 原子操作 |
| 鉴权 | API Key SHA-256 哈希 + JWT Session Cookie |
| 部署 | Docker Compose 一键启动，阿里云 ACR 镜像，Nginx 反向代理 |
| 邮件 | Resend API，自定义域名，全网可达 |

### 1.2 技术栈

| 层 | 技术 | 理由 |
|---|------|------|
| 网关 | Go 1.22 + Fiber v2 | 256K 并发连接，<1ms 路由开销 |
| 前端 | Next.js 14 (App Router) + React 18 | SSR/SSG 混合渲染 |
| UI | TailwindCSS + Framer Motion + Recharts | 原子化 CSS + 动画 + 图表 |
| 数据库 | PostgreSQL 16 | ACID 事务 |
| 缓存 | Redis 7 | 鉴权缓存、限流、渠道并发计数 |
| 反向代理 | Nginx | camellia.online / admin / api 路由 |
| 容器 | Docker Compose | 一键部署 |
| 镜像仓库 | 阿里云 ACR | 国内极速拉取 |
| 邮件 | Resend | 3000 封/月免费，自定义域名 |
| 支付 | 支付宝（占位） | 预留扫码支付区域 |

---

## 2. 项目结构

```
camellia/
├── gateway/                          # Go 网关
│   ├── cmd/server/main.go             # 入口：依赖注入、路由注册
│   ├── internal/
│   │   ├── billing/
│   │   │   ├── record.go              # 计费记录（底层直写）
│   │   │   ├── worker.go              # 异步 Worker Pool（200条/批）
│   │   │   ├── pricing.go             # 定价引擎（三级缓存）
│   │   │   └── quota.go               # 配额执行器
│   │   ├── config/config.go           # 12-factor 环境配置
│   │   ├── db/
│   │   │   ├── postgres.go            # pgxpool 连接池
│   │   │   └── redis.go              # go-redis 客户端
│   │   ├── handler/
│   │   │   ├── proxy.go               # 核心代理 + SSE 流处理
│   │   │   └── metrics.go             # Prometheus 指标
│   │   ├── middleware/auth.go         # API Key 鉴权中间件
│   │   ├── model/types.go             # 数据模型
│   │   ├── pool/
│   │   │   ├── pool.go                # 渠道池 + 原子并发获取
│   │   │   └── circuit_breaker.go     # 三态熔断器
│   │   ├── ratelimit/token_bucket.go  # 多级限流
│   │   └── tokenizer/tokenizer.go     # tiktoken 分词器
│   ├── migrations/
│   │   ├── 001_init.up.sql
│   │   └── 001_init.down.sql
│   ├── Dockerfile
│   └── go.mod
│
├── frontend/                          # Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Landing Page（弹窗登录、模型池）
│   │   │   ├── layout.tsx              # Root Layout（metadata）
│   │   │   ├── layout-client.tsx       # Client Layout（I18nProvider）
│   │   │   ├── login/page.tsx          # 登录/注册页面
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx          # Dashboard 侧栏 + 鉴权
│   │   │   │   ├── page.tsx            # 用量图表（Token/Cost/Requests）
│   │   │   │   ├── keys/page.tsx       # API Key 管理
│   │   │   │   ├── billing/page.tsx    # 计费套餐 + 支付宝
│   │   │   │   └── settings/page.tsx   # 个人信息 + 改密码
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx          # Admin 鉴权
│   │   │   │   └── page.tsx            # 管理后台（概览/用户/渠道/定价/计费）
│   │   │   └── api/
│   │   │       ├── auth/               # login, register, me, logout, password
│   │   │       ├── dashboard/usage/    # 使用统计
│   │   │       ├── keys/               # API Key CRUD
│   │   │       ├── admin/              # users, channels, pricing, billing, stats, system-metrics
│   │   │       ├── billing/            # checkout, records
│   │   │       └── public/models/      # 公开模型池
│   │   ├── components/
│   │   │   ├── landing/                # HeroParticles, ModelPoolShowcase
│   │   │   ├── dashboard/              # TokenChart, CostChart, RequestsChart
│   │   │   ├── admin/                  # BillingChart
│   │   │   └── ui/                     # Badge, Skeleton, DataTable, LangSwitcher
│   │   ├── hooks/                      # useAuth, useDashboard
│   │   ├── lib/
│   │   │   ├── api.ts                  # API Client
│   │   │   ├── auth.ts                 # JWT 签发/验证 + Cookie
│   │   │   ├── db.ts                   # PostgreSQL 连接池
│   │   │   ├── email.ts                # Resend API 发信
│   │   │   ├── i18n.tsx                # 中文/英文 翻译 + I18nProvider
│   │   │   └── utils.ts                # cn, formatTokens, formatCents, formatDate
│   │   ├── middleware.ts               # 路由保护（Cookie 检查）
│   │   └── types/index.ts
│   ├── Dockerfile
│   ├── next.config.js                  # output: standalone
│   ├── tailwind.config.ts
│   └── package.json
│
├── config/
│   └── Caddyfile                       # Caddy 配置（备选）
├── nginx-camellia.conf                 # 云服务器 Nginx 配置
├── docker-compose.cloud.yml            # 生产环境（ACR 镜像）
├── docker-compose.local.yml            # 本地开发
├── .env.example                        # 环境变量模板
├── .gitignore
└── docs/
    ├── ARCHITECTURE.md                 # 本文档
    └── REDIS_SCHEMA.md
```

---

## 3. 数据库设计

### 3.1 核心表

**users** — 用户表
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | 登录邮箱 |
| username | VARCHAR(50) UNIQUE | 登录用户名 |
| password_hash | VARCHAR(255) | SHA-256(password + llmgw_salt_v2) |
| nickname | VARCHAR(100) | 显示名称 |
| role | ENUM(user,admin) | |
| status | ENUM(active,disabled) | |
| balance_cents | BIGINT | 余额（美分，避免浮点精度） |
| subscription_tier | ENUM(free,vip,enterprise) | |
| daily_token_quota | INT | 每日配额 |
| daily_token_used | INT | 当日已用 |
| remark | TEXT | 管理员备注 |

**api_keys** — API Key 表
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| user_id | FK→users | |
| key_hash | VARCHAR(255) UNIQUE | SHA-256 哈希，原文仅创建时返回一次 |
| key_prefix | VARCHAR(12) | 前缀显示（camellia-xx） |
| name | VARCHAR(100) | 自动命名：Key-2026-05-21-14:30 |
| is_enabled | BOOLEAN | |

**channels** — 渠道表（Token 池）
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| name | VARCHAR(100) | |
| provider | ENUM(openai,azure,anthropic,google,deepseek,custom) | |
| api_key_enc | TEXT | AES-256-GCM 加密存储 |
| base_url | TEXT | API 地址 |
| models | TEXT[] | 支持的模型列表 |
| weight | INT | 同优先级下流量权重 |
| priority | INT | 优先级（越高越优先） |
| max_concurrency | INT | 最大并发连接数 |
| status | ENUM(active,disabled,rate_limited,error) | |

**billing_records** — 计费流水（不可变账本）
| 列 | 类型 | 说明 |
|---|------|------|
| id | BIGSERIAL PK | |
| user_id | FK→users | |
| api_key_id | FK→api_keys | |
| channel_id | FK→channels | |
| model_name | VARCHAR(100) | |
| prompt_tokens | INT | |
| completion_tokens | INT | |
| total_tokens | INT | |
| cost_cents | BIGINT | 扣费金额 |
| balance_after | BIGINT | 扣费后余额 |
| status | VARCHAR(20) | success/error |

**model_pricing** — 模型定价
| 列 | 类型 | 说明 |
|---|------|------|
| model_name | VARCHAR(100) UNIQUE | |
| cost_input_price | REAL | 成本输入价 $/1K |
| cost_output_price | REAL | 成本输出价 $/1K |
| sell_input_price | REAL | 售价输入 $/1K |
| sell_output_price | REAL | 售价输出 $/1K |
| vip_discount | REAL | VIP 折扣（默认 0.9） |
| enterprise_discount | REAL | 企业折扣（默认 0.8） |

**verification_codes** — 验证码（注册用）
| 列 | 类型 | 说明 |
|---|------|------|
| email | VARCHAR(255) | |
| code | VARCHAR(6) | 6 位数字 |
| purpose | VARCHAR(20) | register/login |
| used | BOOLEAN | |
| expires_at | TIMESTAMPTZ | 10 分钟有效 |

### 3.2 关键设计决策

- **余额 BIGINT 存美分**：最小计费 1 cent，避免浮点精度
- **API Key SHA-256 哈希**：原文仅创建时返回一次，数据库只存哈希
- **渠道 Key AES-256-GCM 加密**：密钥通过 ENCRYPTION_KEY 环境变量注入
- **billing_records 不可变**：插入后永不移除，balance_after 实现审计追溯
- **密码哈希**：SHA-256(password + "llmgw_salt_v2")，未用 bcrypt（性能优先）

---

## 4. 网关架构

### 4.1 请求生命周期

```
Client (Authorization: Bearer camellia-xxx)
  │
  ▼
Nginx → /v1/* → gateway:8080
  │
  ▼
Go Gateway (Fiber)
  ├─ Auth Middleware
  │   ├─ SHA-256 hash API Key
  │   ├─ Redis HGetAll "apikey:{hash}" (热路径, <1ms)
  │   └─ Fallback: PostgreSQL + 写入 Redis (5min TTL)
  ├─ Rate Limiting
  │   ├─ IP sliding window (300 RPM)
  │   ├─ User RPM (subscription tier-based)
  │   ├─ User concurrency (Redis INCR atomic)
  │   └─ TPM pre-check (tiktoken estimate)
  ├─ Balance Check (free tier: balance > estimated cost)
  ├─ Channel Acquisition
  │   ├─ Build snapshots (models matching)
  │   ├─ Sort: priority ↓ → available capacity ↓ → weight ↓
  │   ├─ Circuit breaker check
  │   └─ Redis INCR channel:{id}:concurrency
  ├─ executeWithRetry (max 3, exponential backoff 200→400→800ms)
  │   ├─ Proxy request to upstream
  │   ├─ On 429/5xx: RecordError → ReleaseChannel → retry
  │   └─ On success: return response
  └─ Billing (async)
      ├─ Enqueue BillingTask → Worker Pool
      └─ Batch PostgreSQL INSERT (200/tx, 1s flush ticker)
```

### 4.2 渠道选择算法

```go
// 三级排序
// 1. Priority DESC     → 高优先级先选
// 2. AvailableCapacity DESC → (maxConcurrency - currentConcurrency) 大的优先
// 3. Weight DESC       → 同优先级同容量下权重高优先
```

### 4.3 熔断器状态机

```
CLOSED (正常) ──5次连续失败──→ OPEN (全拒)
                                  │
                           冷却时间到
                                  │
                                  ▼
                           HALF-OPEN (探测)
                           2次连续成功 → CLOSED
                           探测失败 → OPEN
```

差异化冷却：401/403→5min, 429→15s, 5xx→30s→60s→120s→5min

---

## 5. 前端架构

### 5.1 页面路由

| 路由 | 功能 | 鉴权 |
|------|------|------|
| `/` | Landing Page（弹窗登录、模型池） | 无 |
| `/login` | 登录/注册页面 | 无 |
| `/dashboard` | 用量图表（Token/Cost/Requests） | JWT Cookie |
| `/dashboard/keys` | API Key 管理（创建/列表/删除） | JWT Cookie |
| `/dashboard/billing` | 计费套餐 + 支付宝 | JWT Cookie |
| `/dashboard/settings` | 个人信息 + 改密码 | JWT Cookie |
| `/admin` | 管理后台 | JWT + admin role |

### 5.2 API 路由

| 端点 | 方法 | 鉴权 | 功能 |
|------|------|------|------|
| `/api/auth/register` | POST | 无 | 注册（两步：发码+验证） |
| `/api/auth/login` | POST | 无 | 登录（邮箱/用户名+密码） |
| `/api/auth/me` | GET/PATCH | Cookie | 当前用户 / 更新昵称 |
| `/api/auth/password` | PATCH | Cookie | 修改密码 |
| `/api/auth/logout` | POST | Cookie | 退出 |
| `/api/keys` | GET/POST/DELETE | Cookie | API Key CRUD |
| `/api/dashboard/usage` | GET | Cookie | 用量聚合 |
| `/api/admin/stats` | GET | Cookie+admin | 系统统计 |
| `/api/admin/users` | GET/PATCH | Cookie+admin | 用户管理 |
| `/api/admin/channels` | GET/POST/DELETE | Cookie+admin | 渠道管理 |
| `/api/admin/pricing` | GET/POST/PATCH | Cookie+admin | 定价管理 |
| `/api/admin/billing` | GET | Cookie+admin | 计费流水 |
| `/api/admin/system-metrics` | GET | Cookie+admin | CPU/内存/负载 |
| `/api/public/models` | GET | 无 | 公开模型池 |

### 5.3 i18n

- 中文默认（`zh`），英文（`en`）可切换
- `src/lib/i18n.tsx` 含完整词典（300+ key）
- localStorage 持久化语言偏好（key: `camellia_lang`）
- `useI18n()` Hook：`{ t, lang, setLang }`
- 首页 Logo：中文显示"山茶花 Camellia"，英文显示"Camellia"

### 5.4 鉴权流程

```
客户端注册 → POST /api/auth/register (email+username+pw)
  → Resend 发 6 位验证码
  → POST /api/auth/register (email+username+pw+code)
  → 创建用户 → JWT 签发 → Cookie 写入

客户端登录 → POST /api/auth/login (email或username + pw)
  → JWT 签发 → Cookie 写入 (httpOnly, SameSite=Lax)

后续请求 → Cookie 自动携带 → Middleware 检查
  → API routes: getSession() → jwtVerify → 注入身份
  → Admin routes: 额外检查 role === "admin"
```

Token 配置：
- 算法: HS256
- 过期: 7 天
- Cookie: `camellia_token`
- Payload: `{ sub: user_id, email, role, tier }`

---

## 6. 部署

### 6.1 本地开发

```bash
# 1. 配置环境
cp .env.example .env
# 编辑 .env 填入 Resend API Key

# 2. 构建启动
docker compose -f docker-compose.local.yml up -d --build

# 3. 访问
open http://localhost:3000          # 前台
open http://localhost:8080/health    # API 网关
```

### 6.2 云服务器部署

```bash
# 1. 创建 docker-compose.yml 和 .env（内容见 docker-compose.cloud.yml）
# 2. 配置 Nginx（内容见 nginx-camellia.conf）
# 3. 登录 ACR
docker login --username Tinwaa crpi-wh50rfv5mqmjohuv.cn-shenzhen.personal.cr.aliyuncs.com

# 4. 启动
docker compose up -d

# 5. 初始化数据库（参见下文 SQL）
docker compose exec -T postgres psql -U camellia -d camellia < init.sql
```

### 6.3 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 连接 | postgres://camellia:PWD@postgres:5432/camellia |
| REDIS_ADDR | Redis 地址 | redis:6379 |
| JWT_SECRET | JWT 密钥 | (必填) |
| ENCRYPTION_KEY | AES-256 密钥（32 hex） | (必填) |
| RESEND_API_KEY | Resend API Key | (必填) |
| EMAIL_FROM | 发件人地址 | Camellia <noreply@camellia.ai> |
| LISTEN_ADDR | Gateway 监听 | :8080 |

### 6.4 ACR 镜像

| 镜像 | Tag | 用途 |
|------|-----|------|
| `camellia_web:gateway` | latest | Go Gateway (55MB) |
| `camellia_web:frontend` | latest | Next.js Frontend (271MB) |

推送命令：
```bash
# 本地构建后
docker build -t llmgw-frontend:latest -f frontend/Dockerfile frontend/
REG=crpi-wh50rfv5mqmjohuv.cn-shenzhen.personal.cr.aliyuncs.com/camellia_ai_web/camellia_web
docker tag llmgw-gateway:local $REG:gateway
docker tag llmgw-frontend:latest $REG:frontend
docker push $REG:gateway
docker push $REG:frontend
```

### 6.5 Nginx 配置

```nginx
server {
    listen 80;
    server_name camellia.online;
    location /v1/ { proxy_pass http://127.0.0.1:8080; proxy_buffering off; }
    location / { proxy_pass http://127.0.0.1:3000; }
}
server { listen 80; server_name api.camellia.online; location / { proxy_pass http://127.0.0.1:8080; } }
server { listen 80; server_name admin.camellia.online; location / { proxy_pass http://127.0.0.1:3000; } }
```

---

## 7. 关键代码片段

### 7.1 API Key 生成（前端）

```typescript
// frontend/src/app/api/keys/route.ts
const rawKey = "camellia-" + crypto.randomBytes(24).toString("hex")
const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
const keyPrefix = rawKey.slice(0, 12) // "camellia-xx"
// 存入 PostgreSQL + 同步 Redis
```

### 7.2 渠道 Key 解密（网关）

```go
// gateway/internal/pool/pool.go
func (cp *ChannelPool) decrypt(encoded string) (string, error) {
    buf, _ := base64.StdEncoding.DecodeString(encoded)
    iv := buf[:12]; tag := buf[12:28]; ciphertext := buf[28:]
    block, _ := aes.NewCipher(cp.encryptionKey)
    aesgcm, _ := cipher.NewGCM(block)
    plaintext, _ := aesgcm.Open(nil, iv, append(ciphertext, tag...), nil)
    return string(plaintext), nil
}
```

### 7.3 密码哈希

```typescript
// SHA-256(password + "llmgw_salt_v2")
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "llmgw_salt_v2").digest("hex")
}
```

### 7.4 计费公式

```
cost_cents = (prompt_tokens / 1000 * sell_input_price * 100)
           + (completion_tokens / 1000 * sell_output_price * 100)
最小 1 cent
```

### 7.5 邮件发送（Resend）

```typescript
// frontend/src/lib/email.ts
await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Authorization": `Bearer ${RESEND_API_KEY}` },
  body: JSON.stringify({ from: EMAIL_FROM, to: [email], subject, html })
})
```

---

## 8. 常见操作

### 8.1 添加新渠道

Admin → 渠道管理 → 添加：
```
名称: DeepSeek-V4
供应商: custom
API Key: sk-xxx
Base URL: https://api.deepseek.com
模型: deepseek-v4-pro,deepseek-v4-flash
权重: 1
优先级: 0
最大并发: 10
```

批量导入格式（每行一个渠道）：
```
名称|供应商|APIKey|BaseURL|模型列表
```

### 8.2 设置管理员

```sql
UPDATE users SET role = 'admin' WHERE email = 'xxx@xxx.com';
```

### 8.3 用户充值

```sql
UPDATE users SET balance_cents = 1000000 WHERE email = 'xxx@xxx.com';
```

### 8.4 添加模型定价

```sql
INSERT INTO model_pricing (model_name, model_display, cost_input_price, cost_output_price, sell_input_price, sell_output_price)
VALUES ('deepseek-v4-flash', 'DeepSeek V4 Flash', 0.14, 0.28, 0.20, 0.40);
```

---

## 9. GitHub 仓库

- **仓库**: https://github.com/T1anhu4/Camellia_Web
- **作者**: T1anhu4
- **主分支**: main
- **克隆**: `git clone https://github.com/T1anhu4/Camellia_Web.git`

---

> 文档版本: v2.0 | 最后更新: 2026-05-21 | 品牌: Camellia（山茶花）
