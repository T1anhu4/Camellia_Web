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
| 邮件 | Resend API 双重发送（自定义域名 → fallback 默认发件人） |
| 国际化 | 中文默认，英文可切换，300+ key 完整词典 |

### 1.2 技术栈

| 层 | 技术 | 理由 |
|---|------|------|
| 网关 | Go 1.22 + Fiber v2 | 256K 并发连接，<1ms 路由开销 |
| 前端 | Next.js 14 (App Router) + React 18 | SSR/SSG 混合渲染 |
| UI | TailwindCSS + Framer Motion + Recharts | 原子化 CSS + 动画 + 图表 |
| UI 风格 | Zenmux 浅色模式 | 白底黑字、大标题排版、黑色按钮、浅灰卡片边框 |
| 数据库 | PostgreSQL 16 | ACID 事务 |
| 缓存 | Redis 7 | 鉴权缓存、限流、渠道并发计数 |
| 定价 | 人民币 ¥ | 全局人民币符号，美分存储 |
| 反向代理 | Nginx | camellia.online / admin / api 路由 |
| 容器 | Docker Compose | 一键部署 |
| 镜像仓库 | 阿里云 ACR | 国内极速拉取 |
| 邮件 | Resend | 双重发送：自定义域名 → onboarding@resend.dev |
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
│   │   │   ├── pricing.go             # 定价引擎（三级缓存），nil-safe rdb/pg
│   │   │   ├── pricing_test.go        # 定价引擎测试（9 用例）
│   │   │   ├── quota.go               # 配额执行器
│   │   │   ├── quota_test.go          # 配额测试（8 用例）
│   │   │   └── payment/
│   │   │       ├── provider.go        # 支付抽象接口
│   │   │       └── stripe.go          # Stripe Stub 实现
│   │   ├── config/config.go           # 12-factor 环境配置
│   │   │   └── config_test.go         # 配置测试（5 用例）
│   │   ├── db/
│   │   │   ├── postgres.go            # pgxpool 连接池
│   │   │   └── redis.go              # go-redis 客户端
│   │   ├── handler/
│   │   │   ├── proxy.go               # 核心代理 + SSE 流处理
│   │   │   ├── metrics.go             # Prometheus 指标（原子计数器）
│   │   │   └── metrics_test.go        # 指标测试（12 用例）
│   │   ├── middleware/
│   │   │   ├── auth.go                # API Key 鉴权中间件
│   │   │   └── auth_test.go           # 鉴权测试（6 用例）
│   │   ├── model/
│   │   │   ├── types.go               # 数据模型
│   │   │   └── types_test.go          # 模型测试（6 用例）
│   │   ├── pool/
│   │   │   ├── pool.go                # 渠道池 + 原子并发获取
│   │   │   ├── pool_test.go           # 池测试（17 用例）
│   │   │   ├── circuit_breaker.go     # 三态熔断器
│   │   │   └── circuit_breaker_test.go # 熔断器测试（16 用例）
│   │   ├── ratelimit/
│   │   │   ├── token_bucket.go        # 多级限流（滑动窗口 + 令牌桶 + 并发）
│   │   │   └── ratelimit_test.go      # 限流测试（4 用例）
│   │   └── tokenizer/
│   │       ├── tokenizer.go           # tiktoken 分词器（内嵌 cl100k_base）
│   │       └── tokenizer_test.go      # 分词器测试（28 用例）
│   ├── migrations/
│   │   ├── 001_init.up.sql            # 初始 Schema（含 username 列）
│   │   └── 001_init.down.sql
│   ├── Dockerfile                     # 多阶段构建，Alpine 精简（55MB）
│   ├── go.mod
│   └── go.sum
│
├── frontend/                          # Next.js 前端
│   ├── public/                        # 静态资源目录
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Landing Page（模型轮播 + Zenmux 风格 Hero）
│   │   │   ├── layout.tsx              # Root Layout（metadata，中文 title）
│   │   │   ├── layout-client.tsx       # Client Layout（I18nProvider，浅色主题）
│   │   │   ├── globals.css             # 全局样式（Zenmux 浅色组件类）
│   │   │   ├── login/page.tsx          # 登录/注册页面（浅色卡片，全 i18n）
│   │   │   ├── models/page.tsx         # 模型库（Zenmux 大卡片：Logo+描述+定价+能力标签）
│   │   │   ├── docs/page.tsx           # API 文档（5语言代码示例+OpenAI兼容指南）
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx          # Dashboard 侧栏（NavBar下方，不遮挡内容）
│   │   │   │   ├── page.tsx            # 用量图表（浅色 Recharts，¥ 符号）
│   │   │   │   ├── keys/page.tsx       # API Key 管理（深色背景绿色代码+复制按钮）
│   │   │   │   ├── billing/page.tsx    # 计费套餐 + 支付宝
│   │   │   │   └── settings/page.tsx   # 个人信息 + 改密码
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx          # Admin 鉴权（浅色主题）
│   │   │   │   └── page.tsx            # 管理后台（5 Tab：概览/用户/渠道/定价/计费）
│   │   │   └── api/
│   │   │       ├── auth/               # login, register, me, logout, password, send-code, verify-code
│   │   │       ├── dashboard/usage/    # 使用统计
│   │   │       ├── dashboard/stats/    # 账户统计
│   │   │       ├── keys/               # API Key CRUD + [id] 删除
│   │   │       ├── admin/              # users, channels, pricing, billing, stats, system-metrics, test-email
│   │   │       ├── billing/            # checkout, records, webhook
│   │   │       └── public/models/      # 公开模型池（按 provider 分组聚合）
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── nav-bar.tsx          # 全局导航栏（hover 用户下拉，全平台复用）
│   │   │   ├── landing/
│   │   │   │   ├── hero-particles.tsx   # Hero 粒子背景（保留）
│   │   │   │   ├── model-pool-showcase.tsx # 模型展示（保留）
│   │   │   │   └── model-carousel.tsx   # 模型滚动轮播（首页新增）
│   │   │   ├── dashboard/              # TokenChart, CostChart, RequestsChart（浅色主题 + ¥）
│   │   │   ├── admin/                  # BillingChart（保留）
│   │   │   └── ui/                     # Badge, Skeleton, DataTable, LangSwitcher（浅色主题）
│   │   ├── hooks/                      # useAuth, useDashboard
│   │   ├── lib/
│   │   │   ├── api.ts                  # API Client（完整 20+ 方法）
│   │   │   ├── auth.ts                 # JWT 签发/验证 + Cookie（HS256, 7天）
│   │   │   ├── db.ts                   # PostgreSQL 连接池（pg, max 20）
│   │   │   ├── email.ts                # Resend API 双重发送（自定义域名 → onboarding@resend.dev）
│   │   │   ├── i18n.tsx                # 中文/英文 翻译 + I18nProvider（300+ key，默认中文）
│   │   │   ├── models.tsx              # 模型元数据系统（15+ 厂商 Logo + 描述 + 定价 + 能力标签）
│   │   │   ├── redis.ts                # Redis 客户端（auto-connect）
│   │   │   └── utils.ts                # cn, formatTokens, formatCents(¥), formatDate
│   │   ├── middleware.ts               # 路由保护（Cookie 检查）
│   │   └── types/index.ts
│   ├── Dockerfile                      # 多阶段构建，standalone 输出（271MB）
│   ├── next.config.js                  # output: standalone
│   ├── tailwind.config.ts              # Zenmux 浅色主题（surface 加深色阶）
│   ├── tsconfig.json
│   └── package.json
│
├── config/
│   └── Caddyfile                       # Caddy 配置（备选，含速率限制+安全头）
├── nginx-camellia.conf                 # 云服务器 Nginx 配置（三域名：camellia/api/admin）
├── docker-compose.cloud.yml            # 生产环境（ACR 镜像）
├── docker-compose.local.yml            # 本地开发（含 Mailpit 邮箱测试）
├── docker-compose.dev.yml              # 仅数据库（本地跑 gateway+frontend）
├── docker-compose.production.yml       # 完整生产环境（Caddy+多副本+资源限制）
├── Makefile                            # 开发/构建/部署 Makefile
├── scripts/deploy.sh                   # 生产部署脚本（蓝绿部署+健康检查+备份还原）
├── .env.example                        # 环境变量模板
├── .env                                # 本地开发环境变量（git ignore）
├── .gitignore
└── docs/
    ├── ARCHITECTURE.md                 # 本文档
    └── REDIS_SCHEMA.md
```

---

## 3. 数据库设计

### 3.1 核心表（8 张表 + 种子数据）

**users** — 用户表
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | 登录邮箱 |
| username | VARCHAR(50) UNIQUE | 登录用户名（**v2.1 新增**） |
| password_hash | VARCHAR(255) | SHA-256(password + llmgw_salt_v2) |
| nickname | VARCHAR(100) | 显示名称 |
| role | ENUM(user,admin) | |
| status | ENUM(active,disabled) | |
| balance_cents | BIGINT | 余额（美分，等价于人民币分，最小计费 1 分） |
| subscription_tier | ENUM(free,vip,enterprise) | |
| daily_token_quota | INT | 每日配额 |
| daily_token_used | INT | 当日已用 |
| remark | TEXT | 管理员备注 |

**api_keys** — API Key 表
**channels** — 渠道表（Token 池）
**billing_records** — 计费流水（不可变账本）
**model_pricing** — 模型定价
**subscription_plans** — 套餐计划（Free/VIP/Enterprise 种子数据）
**verification_codes** — 验证码（注册用，10 分钟有效）
**audit_logs** — 管理员审计日志

### 3.2 关键设计决策

- **余额 BIGINT 存分**：最小计费 1 分（¥0.01），避免浮点精度
- **人民币 ¥ 为全局价格符号**：前端展示和模型定价统一使用 ¥
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

差异化冷却：401/403→5min, 429→15s, 5xx→30s→60s→120s→5min（指数退避，上限 5min）

---

## 5. 前端架构

### 5.1 设计系统（v2.1 Zenmux 风格）

**从暗黑模式全面切换为浅色模式**：
- 主背景：`#fafafa`（surface-50）/ `#fff`（白色卡片）
- 卡片：白色背景 + 1px `#e8e8e8`（surface-300）边框 + 20px 圆角
- 按钮主要：黑色背景（surface-950）白色文字 + 12px 圆角
- 文字颜色加深（v2.1）：surface-700=#666, surface-800=#555, surface-900=#333, surface-950=#000
- 排版：Hero 标题 36-80px bold，Section 标题 28-50px bold

### 5.2 全局导航栏

共享组件 `components/layout/nav-bar.tsx`，所有页面统一使用：
- 固定顶部，白色半透明背景 + backdrop-blur
- Logo（左）+ 模型/文档/控制台链接 + 语言切换 + 用户区域（右）
- 登录状态：头像圆圈 + 用户名 + **hover 下拉菜单**（非点击）
- 下拉菜单内容：Token 余量、钱包余额（+充值按钮）、个人资料、管理后台、退出登录

### 5.3 页面路由

| 路由 | 功能 | 鉴权 | NavBar |
|------|------|------|--------|
| `/` | Landing Page（Hero + 模型轮播 + 功能卡片） | 无 | 白底 |
| `/login` | 登录/注册页面 | 无 | 无（独立页） |
| `/models` | 模型库（Zenmux 大卡片：Logo+描述+定价+能力） | 无 | 白底 |
| `/docs` | API 文档（5语言代码示例+OpenAI SDK 兼容指南） | 无 | 白底 |
| `/dashboard` | 用量图表（Token/Cost/Requests，¥） | JWT Cookie | 白底 + 侧栏 |
| `/dashboard/keys` | API Key 管理（深色背景绿色代码显示） | JWT Cookie | 白底 + 侧栏 |
| `/dashboard/billing` | 计费套餐 + 支付宝 | JWT Cookie | 白底 + 侧栏 |
| `/dashboard/settings` | 个人信息 + 改密码 | JWT Cookie | 白底 + 侧栏 |
| `/admin` | 管理后台（5 Tab，浅色主题） | JWT + admin | 白底 + 侧栏 |

### 5.4 模型元数据系统

`lib/models.tsx` — 15+ 厂商预设：
- **厂商 Logo**（SVG/纯色圆角方块）：OpenAI、Anthropic、Google、DeepSeek、Qwen、Meta、Mistral、智谱、百度、xAI
- **智能匹配**：根据模型名自动识别厂商（gpt→OpenAI, claude→Anthropic, gemini→Google...）
- **完整元数据**：描述（中/英）、上下文窗口、最大输出、输入/输出价格（¥/M tokens）、能力标签
- **首页轮播**：`components/landing/model-carousel.tsx` — requestAnimationFrame 无限循环滚动

### 5.5 邮件系统

双重发送策略（`lib/email.ts`）：
1. 先尝试自定义域名发送（`EMAIL_FROM`，如 `noreply@camellia.online`）
2. 如失败自动 fallback 到 Resend 默认发件人 `onboarding@resend.dev`
3. 无 RESEND_API_KEY 时 DEV 模式，验证码打印到控制台

### 5.6 i18n

- 中文默认（`zh`），英文（`en`）可切换
- `lib/i18n.tsx` 含完整词典（300+ key）
- localStorage 持久化语言偏好（key: `camellia_lang`）
- 初始化强制 `zh`，仅在 localStorage 明确存有 `en` 时才切换到英文
- `useI18n()` Hook：`{ t, lang, setLang }`
- 价格符号随语言自动适配

### 5.7 API 路由

| 端点 | 方法 | 鉴权 | 功能 |
|------|------|------|------|
| `/api/auth/register` | POST | 无 | 注册（两步：发码+验证） |
| `/api/auth/login` | POST | 无 | 登录（支持邮箱/用户名+密码） |
| `/api/auth/me` | GET/PATCH | Cookie | 当前用户 / 更新昵称 |
| `/api/auth/password` | PATCH | Cookie | 修改密码 |
| `/api/auth/logout` | POST | Cookie | 退出 |
| `/api/auth/send-code` | POST | 无 | 发送验证码（Resend 双重发送） |
| `/api/auth/verify-code` | POST | 无 | 验证码登录（自动注册新用户） |
| `/api/keys` | GET/POST/DELETE | Cookie | API Key CRUD |
| `/api/dashboard/usage` | GET | Cookie | 用量聚合（按天） |
| `/api/dashboard/stats` | GET | Cookie | 账户总计 |
| `/api/admin/stats` | GET | Cookie+admin | 系统统计 |
| `/api/admin/users` | GET/PATCH | Cookie+admin | 用户管理 |
| `/api/admin/channels` | GET/POST/DELETE | Cookie+admin | 渠道管理 |
| `/api/admin/pricing` | GET/POST/PATCH | Cookie+admin | 定价管理 |
| `/api/admin/billing` | GET | Cookie+admin | 计费流水 |
| `/api/admin/system-metrics` | GET | Cookie+admin | CPU/内存/负载 |
| `/api/admin/test-email` | POST | Cookie+admin | 测试邮件发送 |
| `/api/public/models` | GET | 无 | 公开模型池（按 provider 聚合） |
| `/api/billing/checkout` | POST | Cookie | 创建支付订单 |
| `/api/billing/records` | GET | Cookie | 用户计费记录 |
| `/api/billing/webhook` | POST | 无 | 支付回调 |

---

## 6. 测试用例

### 6.1 Go 网关测试（55 个用例，全部 PASS）

```
gateway/internal/billing/pricing_test.go       — 9 tests  (CalculateCost 各 tier/折扣/最小值/未知模型)
gateway/internal/billing/quota_test.go          — 8 tests  (QuotaEnforcer, BillingTask, TodayKey)
gateway/internal/config/config_test.go          — 5 tests  (Load defaults/from-env/fallback)
gateway/internal/handler/metrics_test.go        — 12 tests (原子计数器 + 并发安全 + tier 默认值)
gateway/internal/middleware/auth_test.go        — 6 tests  (hashKey 确定性/长度, toInt 类型转换)
gateway/internal/model/types_test.go            — 6 tests  (JSON 序列化, PasswordHash 不可见)
gateway/internal/pool/circuit_breaker_test.go   — 16 tests (全状态转换/冷却/探针/并发安全)
gateway/internal/pool/pool_test.go              — 17 tests (排序算法/解密/ChannelSnapshot)
gateway/internal/ratelimit/ratelimit_test.go    — 4 tests  (NewTokenBucket, RateLimitError)
gateway/internal/tokenizer/tokenizer_test.go    — 28 tests (分词/CJK/多模态/解析响应)
```

**运行方式**（本机无 Go 环境时用 Docker）：
```bash
docker run --rm -v $(pwd)/gateway:/build -w /build golang:1.22-alpine go test ./... -count=1
```

### 6.2 测试覆盖要点

| 模块 | 关键测试 |
|------|---------|
| CircuitBreaker | 初始 Closed、5 次失败→Open、HalfOpen→Closed 恢复、401/403 即时断路、429 短冷却、Exponential Backoff 上限 |
| Tokenizer | 空字符串、短词、长文、CJK、多模态图片、chat message overhead、response usage 解析 |
| Pricing | Free/VIP/Enterprise 折扣、输入/输出分别计价、最小 1 分、nil rdb/pg 安全 |
| Pool | 优先级排序、可用容量排序、权重平局、解密无效输入、ChannelSnapshot |
| Metrics | 原子递增、并发安全（100 goroutines）、SSE 开始/结束配对 |

---

## 7. 部署

### 7.1 本地开发

```bash
# 1. 配置环境
cp .env.example .env
# 编辑 .env 填入 RESEND_API_KEY（必填，否则邮件不可用）

# 2. 构建启动（全栈：PG + Redis + Mailpit + Gateway + Frontend）
docker compose -f docker-compose.local.yml up -d --build

# 3. 访问
open http://localhost:3000          # 前台（中文默认，浅色主题）
open http://localhost:3000/models    # 模型库
open http://localhost:3000/docs      # API 文档
open http://localhost:8080/health    # API 网关
open http://localhost:8080/metrics   # Prometheus 指标
open http://localhost:8025           # Mailpit 邮箱测试
```

### 7.2 云服务器部署

```bash
# 1. 创建 .env（参考 .env.example）
# 2. 配置 Nginx（参考 nginx-camellia.conf）
# 3. 登录 ACR（阿里云容器镜像）
docker login --username Tinwaa crpi-wh50rfv5mqmjohuv.cn-shenzhen.personal.cr.aliyuncs.com

# 4. 使用 cloud compose
docker compose -f docker-compose.cloud.yml up -d

# 5. 初始化数据库
docker compose exec -T postgres psql -U camellia -d camellia < gateway/migrations/001_init.up.sql
```

### 7.3 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 连接 | postgres://llmgateway:devpassword@postgres:5432/llmgateway |
| REDIS_ADDR | Redis 地址 | redis:6379 |
| JWT_SECRET | JWT 密钥（HS256） | (必填) |
| ENCRYPTION_KEY | AES-256 密钥（32 hex） | (必填) |
| RESEND_API_KEY | Resend API Key | (必填，否则邮件不可用) |
| EMAIL_FROM | 自定义发件人 | Camellia <noreply@camellia.online> |
| LISTEN_ADDR | Gateway 监听 | :8080 |
| SMTP_HOST | SMTP 服务器 | mailpit（本地） |

### 7.4 ACR 镜像

| 镜像 | Tag | 用途 |
|------|-----|------|
| `camellia_web:gateway` | latest | Go Gateway (55MB) |
| `camellia_web:frontend` | latest | Next.js Frontend (271MB) |

---

## 8. 变更记录

### v2.1 — 2026-05-21 · Zenmux 风格重设计

**前端全面重写**：
- 暗黑模式 → 浅色模式（Zenmux 风格白色背景、黑色按钮）
- TailwindCSS 色彩体系重定义（surface 色阶加深）
- 全局共享 NavBar（hover 用户下拉，所有页面统一）
- 新增 `/models` 模型库页面（Zenmux 大卡片：Logo+描述+定价+能力标签）
- 新增 `/docs` API 文档页面（5 语言代码示例：curl/Python/JS/Go/Java）
- 新增模型轮播组件（首页无限滚动厂商 Logo）
- 新增模型元数据系统（15+ 厂商预设，智能识别）
- 价格全局改为人民币 ¥
- Dashboard 布局修复（NavBar 不遮挡内容）
- API Key 显示修复（深色背景 + 绿色代码，清晰可读）
- i18n 默认中文（移除 localStorage 干扰）
- Toast 修复（`{fragment}` → 正确人名）

**后端修复**：
- Migration 新增 `username VARCHAR(50) UNIQUE` 列
- PricingEngine nil rdb/pg 安全防护
- 前端 Redis lazyConnect → 自动连接

**邮件**：
- Resend 双重发送（自定义域名 → onboarding@resend.dev fallback）

**测试**：
- 新增 Go 测试 55 个用例（8 包全部 PASS）

---

## 9. GitHub 仓库

- **仓库**: https://github.com/T1anhu4/Camellia_Web
- **作者**: T1anhu4
- **主分支**: main
- **克隆**: `git clone https://github.com/T1anhu4/Camellia_Web.git`

---

> 文档版本: v2.1 | 最后更新: 2026-05-21 | 品牌: Camellia（山茶花）| 定价: ¥
