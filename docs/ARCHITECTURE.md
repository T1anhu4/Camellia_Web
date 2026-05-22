# Camellia — 山茶花大模型 API 调度平台

## 完整架构文档 · Claude Code 接手即用

> 版本: v3.2 | 更新: 2026-05-22 | 作者: T1anhu4
> GitHub: https://github.com/T1anhu4/Camellia_Web

---

## 1. 项目概述

**Camellia**（山茶花）是一套企业级大模型 API 统一调度网关与商业化分发平台。Go Fiber 网关 + Next.js 14 前端 + PostgreSQL + Redis。

### 1.1 当前进度

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户注册/登录 | ✅ | 邮箱+用户名+密码，Resend 邮件验证码 |
| API Key 管理 | ✅ | camellia- 前缀，SHA-256 哈希，自动生成 |
| 模型池管理 | ✅ | 先建池→再导入 Key（批量导入），P0-P5 优先级 |
| 渠道余额监控 | ✅ | DeepSeek/proaiapi 自动余额查询 + 进度条 + 定时刷新 |
| 渠道调度 | ✅ | 模型池→渠道映射，自动负载均衡，熔断保护 |
| 计费引擎 | ✅ | 按次/按量双模式，10^-8 元精度，RMB 计价 |
| 前台首页 | ✅ | 浅色 Zenmux 风格，模型轮播，NavBar 全平台复用 |
| 用户中台 | ✅ | Dashboard/钱包/计费/设置，NavBar 不遮挡内容 |
| 管理后台 | ✅ | 概览/用户/渠道(批量导入)/定价/计费，删除确认弹窗 |
| API 网关 | ✅ | OpenAI 兼容 /v1，动态模型列表，display_name 映射 |
| Docker 部署 | ✅ | 本地 dev，阿里云 ACR 镜像，Nginx 反代 |
| 邮件系统 | ✅ | Resend 双重发送（自定义域名 → onboarding@resend.dev fallback） |
| API 文档 | ✅ | /docs 页面：5 语言代码示例 + OpenAI SDK 兼容指南 |
| 模型广场 | ✅ | /models 页面：Zenmux 大卡片 + 能力标签 + 定价 |
| proaiapi 批量注册 | ✅ | register_proaiapi.py / register_batch.py 脚本 |

---

## 2. 项目结构

```
camellia/
├── gateway/                          # Go 网关
│   ├── cmd/server/main.go             # 入口
│   ├── internal/
│   │   ├── billing/
│   │   │   ├── record.go              # 计费记录（model_pools 按次/按量，10^-8 元精度）
│   │   │   ├── worker.go              # 异步 Worker Pool（balance 扣除 / 1_000_000）
│   │   │   ├── pricing.go             # 定价引擎（nil-safe rdb/pg）
│   │   │   ├── pricing_test.go        # 定价测试（9 用例）
│   │   │   ├── quota.go               # 配额
│   │   │   └── quota_test.go          # 配额测试（8 用例）
│   │   ├── config/config.go           # 环境配置
│   │   │   └── config_test.go         # 配置测试（5 用例）
│   │   ├── db/                        # postgres.go, redis.go
│   │   ├── handler/
│   │   │   ├── proxy.go               # 核心代理 + SSE + display_name→内部名 + 余额检查(单位转换)
│   │   │   ├── list_models.go         # 动态模型列表（model_pools + 活跃渠道过滤）
│   │   │   ├── metrics.go             # Prometheus
│   │   │   └── metrics_test.go        # 指标测试（12 用例）
│   │   ├── middleware/auth.go         # API Key 鉴权
│   │   │   └── auth_test.go           # 鉴权测试（6 用例）
│   │   ├── model/
│   │   │   ├── types.go               # 数据模型
│   │   │   └── types_test.go          # 模型测试（6 用例）
│   │   ├── pool/
│   │   │   ├── pool.go                # 渠道池（AES-256-GCM 解密）
│   │   │   ├── pool_test.go           # 池测试（17 用例）
│   │   │   ├── circuit_breaker.go     # 三态熔断器
│   │   │   └── circuit_breaker_test.go # 熔断器测试（16 用例）
│   │   ├── ratelimit/
│   │   │   ├── token_bucket.go        # 多级限流
│   │   │   └── ratelimit_test.go      # 限流测试（4 用例）
│   │   └── tokenizer/
│   │       ├── tokenizer.go           # tiktoken 分词
│   │       └── tokenizer_test.go      # 分词测试（28 用例）
│   ├── migrations/
│   │   ├── 001_init.up.sql            # 初始 Schema（含 username 列）
│   │   ├── 002_model_pools.up.sql     # 模型池表 + channels 增强
│   │   └── 003_channel_balance.up.sql # 渠道余额字段
│   ├── Dockerfile                     # 多阶段构建，Alpine（55MB）
│   └── go.mod
│
├── frontend/                          # Next.js 前端
│   ├── public/
│   ├── src/app/
│   │   ├── page.tsx                    # 首页（浅色 Zenmux，模型轮播，NavBar）
│   │   ├── layout.tsx / layout-client.tsx  # Root Layout + I18nProvider（浅色主题）
│   │   ├── globals.css                 # Tailwind + 浅色组件类（card/btn/input/section）
│   │   ├── login/page.tsx              # 登录/注册（双Tab，全 i18n）
│   │   ├── models/page.tsx             # 模型广场（Zenmux 大卡片）
│   │   ├── docs/page.tsx               # API 文档（5 语言代码示例）
│   │   ├── dashboard/
│   │   │   ├── layout.tsx              # 侧栏（NavBar 下方，不遮挡）
│   │   │   ├── page.tsx                # 用量图表
│   │   │   ├── keys/page.tsx           # API Key 管理（深色背景绿色代码）
│   │   │   ├── wallet/page.tsx         # 钱包（余额+Token 套餐）
│   │   │   ├── billing/page.tsx        # 计费（Token 用量+模型明细）
│   │   │   └── settings/page.tsx       # 设置
│   │   ├── admin/
│   │   │   ├── layout.tsx              # Admin 鉴权
│   │   │   └── page.tsx                # 管理后台（批量导入+余额进度条+删除确认）
│   │   └── api/
│   │       ├── auth/                   # login, register, me, logout, password, send-code, verify-code
│   │       ├── dashboard/usage/, stats/, model-usage/  # 使用统计
│   │       ├── keys/                   # API Key CRUD
│   │       ├── admin/
│   │       │   ├── channels/route.ts           # 渠道 CRUD（含 balance 字段+创建时自动查余额）
│   │       │   ├── channels/check-balance/route.ts  # 余额查询（DeepSeek/proaiapi）
│   │       │   ├── model-pools/route.ts        # 模型池 CRUD（含服务端余额刷新）
│   │       │   ├── users/, pricing/, billing/, stats/, system-metrics/, test-email/
│   │       ├── billing/                # checkout, records, webhook
│   │       └── public/models/          # 公开模型池
│   ├── components/
│   │   ├── landing/                    # HeroParticles, ModelCarousel(无限滚动), ModelPoolShowcase
│   │   ├── dashboard/                  # TokenChart, CostChart, RequestsChart（浅色+¥）
│   │   ├── layout/nav-bar.tsx          # 全局导航栏（hover 下拉，全平台复用）
│   │   └── ui/                         # Badge, Skeleton, DataTable, LangSwitcher
│   ├── hooks/                          # useAuth（含 DB 实时角色校验）, useDashboard
│   ├── lib/
│   │   ├── api.ts                      # API Client（30+ 方法）
│   │   ├── auth.ts                     # JWT + Cookie（getSession 实时 DB 校验角色）
│   │   ├── db.ts                       # PostgreSQL
│   │   ├── email.ts                    # Resend 双重发送（自定义域名→onboarding@resend.dev）
│   │   ├── i18n.tsx                    # 中/英翻译（300+ key，默认中文）
│   │   ├── models.tsx                  # 模型元数据（15+ 厂商 Logo + 智能匹配）
│   │   ├── redis.ts                    # Redis（auto-connect）
│   │   └── utils.ts                    # cn, formatTokens, formatCents(¥), formatCost(8 位小数)
│   ├── middleware.ts                   # 路由保护
│   ├── tailwind.config.ts              # Zenmux 浅色主题（surface 加深色阶）
│   ├── next.config.js                  # output: standalone
│   └── package.json
│
├── mailcatcher/mail_server.py          # 自建邮件捕获服务（备选）
├── docker-compose.cloud.yml            # 生产部署（ACR 镜像）
├── docker-compose.local.yml            # 本地开发（含 Mailpit）
├── docker-compose.dev.yml              # 仅数据库
├── docker-compose.production.yml       # 完整生产环境
├── Makefile
├── scripts/deploy.sh
├── register_proaiapi.py                # proaiapi 批量注册脚本（Gmail IMAP）
├── register_batch.py                   # proaiapi 批量注册脚本（预购邮箱）
├── .env.example / .env
├── nginx-camellia.conf
└── docs/
    └── ARCHITECTURE.md
```

---

## 3. 数据库设计

### 3.1 users
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | |
| username | VARCHAR(50) UNIQUE | |
| password_hash | VARCHAR(255) | SHA-256(password + llmgw_salt_v2) |
| nickname | VARCHAR(100) | |
| role | ENUM(user,admin) | |
| status | ENUM(active,disabled) | |
| balance_cents | BIGINT | 余额（分，RMB） |
| subscription_tier | ENUM(free,vip,enterprise) | |
| daily_token_quota / daily_token_used | INT | |

### 3.2 api_keys
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| user_id | FK→users | |
| key_hash | VARCHAR(255) UNIQUE | SHA-256 |
| key_prefix | VARCHAR(12) | camellia-xx |
| name | VARCHAR(100) | 自动命名 |

### 3.3 model_pools（模型池）
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| name | VARCHAR(100) UNIQUE | 内部模型名 |
| display_name | VARCHAR(200) | 对外显示名 |
| pricing_mode | VARCHAR(20) | `per_token` 或 `per_call` |
| input_price_cents | INT | 输入价格（分/1M tokens） |
| output_price_cents | INT | 输出价格（分/1M tokens） |
| per_call_price_cents | INT | 每次价格（分） |
| is_active | BOOLEAN | |

### 3.4 channels（渠道 Key）
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| model_pool_id | FK→model_pools | 所属模型池 |
| key_name | VARCHAR(100) | Key 名称（默认同模型池名） |
| provider | ENUM | openai/azure/anthropic/google/deepseek/custom |
| api_key_enc | TEXT | AES-256-GCM 加密 |
| base_url | TEXT | API 地址（选供应商自动填入） |
| models | TEXT[] | 支持的模型列表 |
| key_priority | INT | P0(最高)→P5(最低) |
| max_concurrency | INT | 最大并发 |
| status | ENUM | active/disabled/rate_limited/error |
| notes | TEXT | 备注 |
| **余额监控字段 (v3.2)** | | |
| balance_cents | INT | 当前余额（分） |
| initial_balance_cents | INT | 初始余额（分，首次查询时自动设定） |
| balance_updated_at | TIMESTAMPTZ | 余额更新时间 |
| balance_provider | VARCHAR(50) | 供应商（deepseek / proaiapi） |
| balance_token | TEXT | 用户 Token（DeepSeek=API Key, proaiapi=邮箱:密码） |

### 3.5 billing_records（不可变账本）
| 列 | 说明 |
|---|------|
| cost_cents | 扣费（10^-8 元单位，8 位小数精度） |
| balance_after | 扣后余额（分） |

### 3.6 verification_codes, model_pricing, subscription_plans
（标准表结构，略）

---

## 4. 网关架构

### 4.1 请求生命周期

```
Client → Nginx → /v1/* → gateway:8080
  ├─ Auth: SHA-256 hash → Redis HGetAll apikey:{hash} (<1ms)
  ├─ resolveModel: display_name → 内部名（查询 model_pools）
  ├─ Balance check: CalculateCost(10^-8元) → /1_000_000 → 分 → 比较余额
  ├─ Channel Acquisition (key_priority 排序: P0最高→P5最低)
  ├─ executeWithRetry (max 3, 200→400→800ms backoff)
  └─ Billing (async): model_pools 定价 → 按次/按量 → cost = tokens × price（无最低消费）
```

### 4.2 计费精度（v3.2 重要变更）

```
cost_subunits = promptTokens × inputPriceCents + completionTokens × outputPriceCents
             → 存储为 10^-8 元单位（1 yuan = 100,000,000 subunits）
balance扣除 = cost_subunits / 1,000,000 → 分
```

- **无最低 1 分限制**：实际消耗多少扣多少
- **前端显示**：`formatCost(subunits)` → ¥0.00000000（8 位小数）
- **管理员计费日志**：可查看精确到 8 位小数的扣费

### 4.3 /v1/models 端点

从 model_pools 动态读取（只返回有活跃渠道的池），暴露 display_name，owned_by="Camellia"。

---

## 5. 前端架构

### 5.1 设计系统

Zenmux 浅色风格：
- 主背景：`#fafafa`，卡片：白色 + `#e8e8e8` 边框
- 按钮：黑色背景白色文字，12px 圆角
- 文字：surface-700(#666), surface-800(#555), surface-900(#333), surface-950(#000)
- 全局导航栏：固定顶部白色半透明 + 模糊背景，hover 用户下拉

### 5.2 页面路由

| 路由 | 功能 | 鉴权 | NavBar |
|------|------|------|--------|
| `/` | 首页（Hero + 模型轮播 + 功能卡片） | 无 | 白底 |
| `/login` | 登录/注册 | 无 | 无 |
| `/models` | 模型广场（Zenmux 大卡片） | 无 | 白底 |
| `/docs` | API 文档（5 语言代码） | 无 | 白底 |
| `/dashboard` | 用量图表 | JWT | 白底+侧栏 |
| `/dashboard/keys` | API Key 管理 | JWT | 白底+侧栏 |
| `/dashboard/wallet` | 钱包余额 | JWT | 白底+侧栏 |
| `/dashboard/billing` | 计费统计 | JWT | 白底+侧栏 |
| `/dashboard/settings` | 个人信息+改密码 | JWT | 白底+侧栏 |
| `/admin` | 管理后台（批量导入+余额+删除确认） | JWT+admin | 白底+侧栏 |

### 5.3 NavBar（全局导航栏）

`components/layout/nav-bar.tsx` — 所有页面复用：
- 左侧：Camellia Logo + 名称
- 中间：模型 / 文档 / 控制台 链接
- 右侧：语言切换 + 用户头像（hover 下拉：Token 余量、钱包余额+充值、个人资料、管理后台、退出登录）
- 未登录时显示：登录 + 免费开始按钮

### 5.4 渠道余额监控系统

**供应商**：
- **DeepSeek**：`GET https://api.deepseek.com/user/balance`（API Key 直接查询）
- **proaiapi**：`POST login` → `GET /api/user/self`（邮箱:密码 登录查询，quota/5000 = 元）

**展现**：
- 模型池卡片：余额汇总进度条（绿>50% / 黄>20% / 红）
- Key 行：单条 Key 余额进度条
- 自动刷新：进入池详情 → 服务端自动查询上游余额并更新 DB

**Token 格式**：
- DeepSeek：直接填 `sk-xxx`
- proaiapi：填 `邮箱:密码`

### 5.5 批量导入

渠道管理 → 批量导入按钮：
- 选供应商（自动填 base_url + 余额查询方式）
- 文本区每行：`用户Token | API Key | 模型列表(逗号分隔)`
- 自动创建缺失的模型池，将 Key 分配到对应池
- 创建时自动查询上游余额并设置初始值

### 5.6 i18n

- 中文默认（`zh`），英文切换（300+ key）
- `getSession()` 实时从 DB 校验角色（提权无需重新登录）
- 登录支持用户名/邮箱不区分大小写

### 5.7 邮件系统

Resend API 双重发送：
1. 先尝试 `EMAIL_FROM` 自定义域名
2. 失败自动 fallback 到 `onboarding@resend.dev`

### 5.8 模型元数据系统

`lib/models.tsx`：
- 15+ 厂商 SVG Logo（OpenAI、Anthropic、Google、DeepSeek、Qwen、Meta、Mistral、智谱等）
- 智能匹配：模型名自动识别厂商
- 完整元数据：中/英描述、上下文窗口、最大输出、输入/输出价格、能力标签

---

## 6. 测试用例（55 个，全部 PASS）

| 包 | 文件 | 用例数 |
|----|------|--------|
| billing | pricing_test.go, quota_test.go | 17 |
| config | config_test.go | 5 |
| handler | metrics_test.go | 12 |
| middleware | auth_test.go | 6 |
| model | types_test.go | 6 |
| pool | circuit_breaker_test.go, pool_test.go | 33 |
| ratelimit | ratelimit_test.go | 4 |
| tokenizer | tokenizer_test.go | 28 |

运行：`docker run --rm -v $(pwd)/gateway:/build -w /build golang:1.22-alpine go test ./... -count=1`

---

## 7. 部署

### 7.1 本地开发

```bash
cp .env.example .env
# 编辑 .env 填入 RESEND_API_KEY
docker compose -f docker-compose.local.yml up -d --build

open http://localhost:3000          # 前台
open http://localhost:8080/health    # API 网关
open http://localhost:8025           # Mailpit 邮箱测试
```

### 7.2 环境变量

| 变量 | 说明 |
|------|------|
| DATABASE_URL | PostgreSQL 连接 |
| REDIS_ADDR | Redis 地址 |
| JWT_SECRET | JWT 密钥（HS256） |
| ENCRYPTION_KEY | AES-256 密钥（32 hex） |
| RESEND_API_KEY | Resend API Key（必填） |
| EMAIL_FROM | 发件人地址 |

---

## 8. 批量注册脚本

### register_proaiapi.py
```
python3 register_proaiapi.py <数量> <Gmail地址> <Gmail应用密码>
```
- 利用 Gmail +aliases 生成无限邮箱
- 通过 IMAP 自动读取验证码
- 自动注册 proaiapi → 创建 API Token → 保存结果到 `.md`

### register_batch.py
```
python3 register_batch.py
```
- 预购邮箱列表（Outlook/Gmail 等）
- IMAP/POP3 读取验证码（需邮箱支持基本认证）
- 批量注册 + 创建 Token

---

## 9. 变更记录

### v3.2 — 2026-05-22 · 余额监控 + 批量导入 + 精度升级

- 渠道余额监控系统（DeepSeek/proaiapi 自动查询 + 进度条 + 刷新）
- 计费精度升级到 10^-8 元（8 位小数，无最低消费）
- 批量导入功能（选供应商，文本区填 Token|Key|模型）
- Base URL 自动填入（选供应商自动填）
- Key 名称自动设为模型池名
- NavBar 通过 hover 触发下拉
- Dashboard 布局修复（NavBar 不遮挡内容）
- getSession() 实时 DB 校验角色
- 价格全局改为人民币 ¥
- model_pools 合并（proaiapi-gpt → gpt-4o）
- 模型池删除确认弹窗
- proaiapi 余额查询（登录→session→quota/5000=元）
- 渠道创建时自动查询余额并设置初始值
- 服务端余额刷新（进入池详情时自动更新）
- register_proaiapi.py / register_batch.py 批量注册脚本

---

> 文档版本: v3.2 | 更新: 2026-05-22 | 作者: T1anhu4 | 定价: ¥
