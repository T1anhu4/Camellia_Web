# Camellia — 山茶花大模型 API 调度平台

## 完整架构文档 · Claude Code 接手即用

> 版本: v3.0 | 更新: 2026-05-22 | 作者: T1anhu4
> GitHub: https://github.com/T1anhu4/Camellia_Web

---

## 1. 项目概述

**Camellia**（山茶花）是一套企业级大模型 API 统一调度网关与商业化分发平台。Go Fiber 网关 + Next.js 14 前端 + PostgreSQL + Redis。

### 1.1 当前进度 (截至 2026-05-22)

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户注册/登录 | ✅ | 邮箱+用户名+密码，Resend 邮件验证码 |
| API Key 管理 | ✅ | camellia- 前缀，SHA-256 哈希，自动生成 |
| 模型池管理 | ✅ | 两步创建：先建池→再导入 Key，P0-P5 优先级 |
| 渠道调度 | ✅ | 模型池→渠道映射，自动负载均衡，熔断保护 |
| 计费引擎 | ✅ | 按次/按量双模式，RMB 计价 |
| 前台首页 | ✅ | 浅色主题，模型池展示 |
| 用户中台 | ✅ | Dashboard/钱包/计费/设置 |
| 管理后台 | ✅ | 概览/用户/渠道/定价/计费 |
| API 网关 | ✅ | OpenAI 兼容 /v1，动态模型列表 |
| Docker 部署 | ✅ | 阿里云 ACR 镜像，Nginx 反代 |
| 邮件系统 | ✅ | Resend API，camellia.online 域名 |

---

## 2. 项目结构

```
camellia/
├── gateway/                          # Go 网关
│   ├── cmd/server/main.go             # 入口
│   ├── internal/
│   │   ├── billing/
│   │   │   ├── record.go              # 计费记录（支持 model_pools 按次/按量）
│   │   │   ├── worker.go              # 异步 Worker Pool
│   │   │   ├── pricing.go             # 定价引擎
│   │   │   └── quota.go               # 配额
│   │   ├── config/config.go           # 环境配置
│   │   ├── db/                        # postgres.go, redis.go
│   │   ├── handler/
│   │   │   ├── proxy.go               # 核心代理 + SSE（含 display_name→内部名映射）
│   │   │   ├── list_models.go         # 动态模型列表（从 model_pools 读取）
│   │   │   └── metrics.go             # Prometheus
│   │   ├── middleware/auth.go         # API Key 鉴权
│   │   ├── pool/
│   │   │   ├── pool.go                # 渠道池（AES-256-GCM 解密）
│   │   │   └── circuit_breaker.go     # 三态熔断器
│   │   ├── ratelimit/                 # 多级限流
│   │   └── tokenizer/                 # tiktoken 分词
│   ├── migrations/
│   ├── Dockerfile
│   └── go.mod
│
├── frontend/                          # Next.js 前端
│   ├── src/app/
│   │   ├── page.tsx                    # 首页（浅色主题，NavBar，模型轮播）
│   │   ├── layout.tsx / layout-client.tsx  # Root Layout + I18nProvider
│   │   ├── login/page.tsx              # 登录/注册（双Tab，邮箱验证码注册）
│   │   ├── models/page.tsx             # 模型广场
│   │   ├── docs/page.tsx               # API 文档
│   │   ├── dashboard/
│   │   │   ├── layout.tsx              # 侧栏（Dashboard/密钥/钱包/计费/设置）
│   │   │   ├── page.tsx                # 用量图表（Token/Cost/Requests 三图）
│   │   │   ├── keys/page.tsx           # API Key 管理
│   │   │   ├── wallet/page.tsx         # 钱包（余额+套餐）
│   │   │   ├── billing/page.tsx        # 计费（Token用量+模型明细表）
│   │   │   └── settings/page.tsx       # 设置（个人信息+改密码）
│   │   ├── admin/
│   │   │   ├── layout.tsx              # Admin 鉴权
│   │   │   └── page.tsx                # 管理后台（模型池卡片+Key编辑+用户编辑）
│   │   └── api/                        # 30+ API Routes
│   ├── components/
│   │   ├── landing/                    # HeroParticles, ModelCarousel, ModelPoolShowcase
│   │   ├── dashboard/                  # TokenChart, CostChart, RequestsChart
│   │   ├── layout/nav-bar.tsx          # 全局导航栏
│   │   └── ui/                         # Badge, Skeleton, DataTable, LangSwitcher
│   ├── hooks/                          # useAuth, useDashboard
│   ├── lib/
│   │   ├── api.ts                      # API Client
│   │   ├── auth.ts                     # JWT + Cookie（camellia_token）
│   │   ├── db.ts                       # PostgreSQL
│   │   ├── email.ts                    # Resend API 发信
│   │   ├── i18n.tsx                    # 中/英翻译 + I18nProvider
│   │   ├── models.tsx                  # 模型数据
│   │   └── utils.ts                    # cn, formatTokens, formatCents
│   ├── middleware.ts                   # 路由保护
│   └── globals.css                     # Tailwind + 浅色主题 + PT Sans 字体
├── docker-compose.cloud.yml            # 生产部署（ACR 镜像 + Nginx）
├── docker-compose.local.yml            # 本地开发
├── .env.example
├── nginx-camellia.conf
└── docs/
    └── ARCHITECTURE.md
```

---

## 3. 数据库设计 (核心表)

### 3.1 users
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | |
| username | VARCHAR(50) UNIQUE | 登录用户名 |
| password_hash | VARCHAR(255) | SHA-256(password + llmgw_salt_v2) |
| nickname | VARCHAR(100) | |
| role | ENUM(user,admin) | |
| status | ENUM(active,disabled) | |
| balance_cents | BIGINT | 余额（分，RMB） |
| subscription_tier | ENUM(free,vip,enterprise) | |
| daily_token_quota | INT | 每日配额 |
| daily_token_used | INT | 当日已用 |
| remark | TEXT | 管理员备注 |

### 3.2 api_keys
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| user_id | FK→users | |
| key_hash | VARCHAR(255) UNIQUE | SHA-256 |
| key_prefix | VARCHAR(12) | camellia-xx |
| name | VARCHAR(100) | 自动命名 |

### 3.3 model_pools（模型池 — 核心新增）
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| name | VARCHAR(100) UNIQUE | 内部模型名 |
| display_name | VARCHAR(200) | 对外显示名（/v1/models 暴露此名） |
| pricing_mode | VARCHAR(20) | `per_token` 或 `per_call` |
| input_price_cents | INT | 输入价格（分/1M tokens） |
| output_price_cents | INT | 输出价格（分/1M tokens） |
| per_call_price_cents | INT | 每次价格（分，per_call模式） |
| is_active | BOOLEAN | |

### 3.4 channels（渠道 — Token 池 Key）
| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| model_pool_id | FK→model_pools | 所属模型池 |
| name | VARCHAR(100) | Key 标识 |
| key_name | VARCHAR(100) | 自定义名称 |
| provider | ENUM | openai/azure/anthropic/google/deepseek/custom |
| api_key_enc | TEXT | AES-256-GCM 加密 |
| base_url | TEXT | API 地址 |
| models | TEXT[] | 支持的模型 |
| key_priority | INT | P0(最高)→P5(最低) |
| max_concurrency | INT | 最大并发 |
| status | ENUM | active/disabled/rate_limited/error |
| notes | TEXT | 备注 |

### 3.5 model_pricing（定价表 — 旧，USD/1K）
| 列 | 说明 |
|---|------|
| model_name | 模型名 |
| sell_input_price | 售价输入 $/1K |
| sell_output_price | 售价输出 $/1K |

### 3.6 billing_records（不可变账本）
| 列 | 说明 |
|---|------|
| user_id, api_key_id, channel_id | 关联 |
| model_name | 模型 |
| prompt_tokens, completion_tokens, total_tokens | Token 统计 |
| cost_cents | 扣费（分） |
| balance_after | 扣后余额 |
| status | success/error |

### 3.7 verification_codes
| 列 | 说明 |
|---|------|
| email, code(6位), purpose(register/login) | |
| used, expires_at(10分钟) | |

---

## 4. 网关架构

### 4.1 模型名映射（新增关键功能）

```
用户请求: "DeepSeek V4 Flash" (公开 display_name)
    ↓
resolveModel() → 查询 model_pools.display_name → 转为 "deepseek-v4-flash"
    ↓
渠道匹配 → 找到 channels WHERE model_pool_id = (pool.id)
    ↓
上游请求: 改写 reqBody["model"] = "deepseek-v4-flash"
```

### 4.2 请求生命周期

```
Client → Nginx → /v1/* → gateway:8080
  ├─ Auth: SHA-256 hash → Redis HGetAll apikey:{hash} (<1ms)
  ├─ resolveModel: display_name → internal name
  ├─ Balance check
  ├─ Channel Acquisition (key_priority 排序: P0最高→P5最低)
  ├─ executeWithRetry (max 3, 200→400→800ms backoff)
  └─ Billing (async): model_pools 定价 → 按次/按量 → 扣费
```

### 4.3 计费公式

```go
// 按量 (per_token):
cost = prompt * input_price_cents / 1,000,000 + completion * output_price_cents / 1,000,000

// 按次 (per_call):
cost = per_call_price_cents

// 最低消费: 1 分
```

### 4.4 /v1/models 端点

从 model_pools 动态读取（只返回有活跃渠道的池），暴露 display_name，owned_by 统一为 "Camellia"。

---

## 5. 前端架构

### 5.1 页面路由

| 路由 | 功能 | 鉴权 |
|------|------|------|
| `/` | 首页（浅色主题） | 无 |
| `/login` | 登录/注册 | 无 |
| `/models` | 模型广场 | 无 |
| `/docs` | API 文档 | 无 |
| `/dashboard` | 用量图表 | JWT Cookie |
| `/dashboard/keys` | API Key 管理 | JWT Cookie |
| `/dashboard/wallet` | 钱包余额 | JWT Cookie |
| `/dashboard/billing` | 计费统计 | JWT Cookie |
| `/dashboard/settings` | 设置 | JWT Cookie |
| `/admin` | 管理后台 | JWT + admin |

### 5.2 管理后台功能

**模型池管理**：
- 新建模型池（名称+显示名+定价模式）
- 定价模式：按量(¥/1M tokens) / 按次(¥/次)
- 卡片式展示，Key 健康度进度条
- 点击进入→Key 列表→添加/编辑/删除 Key

**Key 管理**：
- 添加 Key：名称+优先级(P0-P5)+API Key+Base URL+并发+备注
- 编辑 Key：弹窗修改所有字段，可更换 Key
- 优先级 P0 最高（先走），P5 最低（备用）

**用户管理**：
- 全部字段可编辑（文本/下拉/数字）
- 备注栏可输入文本

### 5.3 鉴权流程

```
注册: email+username+pw → Resend 发 6 位码 → 输入验证码 → 创建用户
登录: email 或 username + pw → JWT → Cookie(camellia_token)
管理: getSession() → role === "admin" 检查
```

### 5.4 i18n

- 中文默认，英文可切换
- localStorage key: `camellia_lang`
- Logo: 中文"山茶花Camellia"，英文"Camellia"

---

## 6. 部署

### 6.1 本地开发

```bash
cp .env.example .env  # 填入 RESEND_API_KEY
docker compose -f docker-compose.local.yml up -d --build
# http://localhost:3000
```

### 6.2 云服务器

```bash
docker login --username Tinwaa crpi-wh50rfv5mqmjohuv.cn-shenzhen.personal.cr.aliyuncs.com
docker compose -f docker-compose.cloud.yml up -d
# Nginx: /etc/nginx/sites-enabled/camellia
# 域名: camellia.online / api.camellia.online / admin.camellia.online
```

### 6.3 ACR 镜像

| 镜像 | 说明 |
|------|------|
| `camellia_web:gateway` | Go Gateway (55MB) |
| `camellia_web:frontend` | Next.js (271MB) |

推送：
```bash
docker build -t llmgw-frontend:latest -f frontend/Dockerfile frontend/
REG=crpi-wh50rfv5mqmjohuv.cn-shenzhen.personal.cr.aliyuncs.com/camellia_ai_web/camellia_web
docker tag llmgw-gateway:local $REG:gateway && docker push $REG:gateway
docker tag llmgw-frontend:latest $REG:frontend && docker push $REG:frontend
```

### 6.4 环境变量

| 变量 | 说明 |
|------|------|
| DATABASE_URL | PostgreSQL 连接 |
| REDIS_ADDR | Redis 地址 |
| JWT_SECRET | JWT 密钥 |
| ENCRYPTION_KEY | AES-256 密钥（32 hex） |
| RESEND_API_KEY | Resend API Key |
| EMAIL_FROM | 发件人（Camellia <noreply@camellia.online>） |
| LISTEN_ADDR | Gateway 监听（:8080） |

---

## 7. 常用操作

### 设置管理员
```sql
UPDATE users SET role='admin' WHERE email='xxx';
```

### 添加模型池
Admin → 渠道管理 → 新建模型池 → 填名称+定价 → 创建 → 点进池 → 添加 Key

### API 调用示例
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer camellia-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"DeepSeek V4 Flash","messages":[{"role":"user","content":"你好"}]}'
```

### 接入客户端
```
API 地址: http://localhost:8080/v1 (本地) / http://camellia.online/v1 (生产)
API Key:  camellia-xxx
模型名称: DeepSeek V4 Flash (或其他模型池显示名)
```

---

## 8. 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | Admin123! |
| 管理员 | Tinwaa | (注册时设置) |

---

> 完整代码: https://github.com/T1anhu4/Camellia_Web
> 技术栈: Go 1.22 + Fiber | Next.js 14 | PostgreSQL 16 | Redis 7 | Docker | Resend
