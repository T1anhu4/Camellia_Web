"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

type Lang = "zh" | "en"

// ============================================================
// Translation dictionaries
// ============================================================
const translations: Record<Lang, Record<string, string>> = {
  zh: {
    // --- Billing Page ---
    "billing.title": "计费中心",
    "billing.package.5m": "500万 Tokens",
    "billing.package.10m": "1000万 Tokens",
    "billing.package.50m": "5000万 Tokens",
    "billing.package.100m": "1亿 Tokens",
    "billing.package.5m.desc": "适合个人开发者",
    "billing.package.10m.desc": "适合小团队",
    "billing.package.50m.desc": "适合创业公司",
    "billing.package.100m.desc": "适合企业用户",
    "billing.buy": "立即购买",
    "billing.alipay": "支付宝扫码支付",
    "billing.currentBalance": "当前余额",
    "billing.orderSummary": "订单摘要",
    "billing.selectPackage": "选择套餐",
    "billing.payment": "支付方式",
    "billing.transactionHistory": "交易记录",
    "billing.emptyHistory": "暂无交易记录",
    "billing.scanQR": "请扫描下方二维码支付",
    "billing.perTokenRate": "每千 Token 价格",
    "billing.packagePrice": "套餐价格",
    "billing.total": "合计",

    // --- Settings Page ---
    "settings.title": "设置",
    "settings.profile": "个人信息",
    "settings.nickname": "昵称",
    "settings.save": "保存",
    "settings.saved": "已保存",
    "settings.stats": "账户统计",
    "settings.registeredAt": "注册时间",
    "settings.totalTokens": "累计 Token",
    "settings.totalCost": "累计消费",
    "settings.language": "语言偏好",
    "settings.password": "修改密码",
    "settings.comingSoon": "即将推出",

    // --- Common / Shared ---
    "app.title": "Camellia — 企业级大模型 API 调度网关",
    "app.description": "高性能大模型 API 网关，支持负载均衡、渠道池管理和按量计费",
    "app.keywords": "LLM,API网关,AI,OpenAI,负载均衡,大模型",
    "common.loading": "加载中...",
    "common.retry": "重试",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.delete": "删除",
    "common.edit": "编辑",
    "common.create": "创建",
    "common.refresh": "刷新",
    "common.search": "搜索...",
    "common.enable": "启用",
    "common.disable": "禁用",
    "common.yes": "是",
    "common.no": "否",
    "common.active": "启用",
    "common.disabled": "已禁用",
    "common.total": "共 {n} 条",
    "common.page": "第 {page} / {total} 页",
    "common.back": "返回首页",
    "common.noData": "暂无数据",

    // --- Navbar / Header ---
    "nav.signIn": "登录",
    "nav.getStarted": "立即开始",
    "nav.dashboard": "控制台",
    "nav.apiKeys": "API 密钥",
    "nav.keys": "API 密钥",
    "nav.billing": "计费",
    "nav.settings": "设置",
    "nav.signOut": "退出登录",
    "nav.currentPlan": "当前套餐",

    // --- Language Switcher ---
    "lang.switch": "English",

    // --- Landing Page ---
    "landing.heroBadge": "企业级大模型调度平台",
    "landing.heroTitle": "一个统一 API 网关，让 AI 功能上线速度提升 10 倍",
    "landing.heroSubtitle": "路由、负载均衡、监控、商业化 — 一站式管理所有大模型 API，完美兼容 OpenAI 协议",
    "landing.ctaStart": "免费开始使用",
    "landing.ctaDocs": "查看文档",
    "landing.featuresTitle": "开箱即用，快速上线",
    "landing.featuresSubtitle": "无需重复造轮子，我们已为你准备好一切",
    "landing.feature1Title": "渠道池负载均衡",
    "landing.feature1Desc": "多供应商 API Key 统一管理，优先级、权重、最少连接三级智能调度，故障自动切换",
    "landing.feature2Title": "< 5ms 路由开销",
    "landing.feature2Desc": "基于 Go Fiber 构建，256K 并发连接支撑，极低延迟零缓冲 SSE 流式转发",
    "landing.feature3Title": "内置多级限流",
    "landing.feature3Desc": "IP → RPM → 并发数 → TPM 五级限流保护，Redis Lua 原子操作，滑动窗口 + 令牌桶",
    "landing.feature4Title": "实时用量分析",
    "landing.feature4Desc": "Token 消耗趋势、费用统计图表，7天/30天切换，让你的每一分钱都花得明明白白",
    "landing.feature5Title": "API Key 管理",
    "landing.feature5Desc": "SHA-256 哈希存储，前后缀显示，创建后仅展示一次，自动同步 Redis 缓存",
    "landing.feature6Title": "完全兼容 OpenAI",
    "landing.feature6Desc": "直接替换 base_url 即可接入，支持 Chat Completions、Embeddings、Models 全部端点",
    "landing.ctaBottomTitle": "准备好开始了吗？",
    "landing.ctaBottomDesc": "2 分钟内即可获取 API Key，无需信用卡",
    "landing.ctaBottomButton": "免费注册账号",
    "landing.footer": "© Camellia. 为开发者而生。",
    "landing.chartTitle": "API 用量 — 近 30 天",
    "landing.chartTokens": "{n} 万 Tokens",
    "landing.chartDateRange": "6月1日 - 6月30日",

    // --- Login Page ---
    "login.title": "登录",
    "login.checkEmail": "查看你的邮箱",
    "login.subtitle": "输入邮箱即可接收验证码，新用户将自动注册",
    "login.codeSent": "验证码已发送至 {email}",
    "login.emailLabel": "邮箱地址",
    "login.emailPlaceholder": "you@company.com",
    "login.sendCode": "发送验证码",
    "login.codeLabel": "验证码",
    "login.codePlaceholder": "000000",
    "login.verifySignIn": "验证并登录",
    "login.differentEmail": "换个邮箱",
    "login.terms": "继续即表示你同意我们的服务条款和隐私政策",
    "login.toast.invalidEmail": "请输入有效的邮箱地址",
    "login.toast.codeSent": "验证码已发送到你的邮箱",
    "login.toast.sendFailed": "验证码发送失败",
    "login.toast.invalidCode": "请输入 6 位验证码",
    "login.toast.welcome": "欢迎回来",
    "login.toast.welcomeName": "，{name}",
    "login.toast.welcomeDefault": "！",
    "login.toast.invalidCodeError": "验证码错误",
    "login.passwordLabel": "密码",
    "login.passwordPlaceholder": "输入密码",
    "login.usernameLabel": "用户名",
    "login.usernamePlaceholder": "3-30位字母数字或中文",
    "login.confirmPasswordLabel": "确认密码",
    "login.loginButton": "登录",
    "login.registerButton": "注册",
    "login.tabLogin": "登录",
    "login.tabRegister": "注册",
    "login.toast.passwordMismatch": "两次密码不一致",
    "login.toast.passwordTooShort": "密码至少6位",
    "login.toast.usernameInvalid": "用户名3-30个字符",
    "login.toast.registerSuccess": "注册成功！欢迎",
    "login.toast.loginFailed": "邮箱/用户名或密码错误",

    // --- Dashboard Page ---
    "dashboard.title": "控制台",
    "dashboard.welcome": "欢迎回来，{name}",
    "dashboard.tabs.usage": "用量",
    "dashboard.tabs.keys": "密钥",
    "dashboard.period.7days": "7 天",
    "dashboard.period.30days": "30 天",
    "dashboard.stats.totalTokens": "总 Token",
    "dashboard.stats.totalRequests": "总请求数",
    "dashboard.stats.totalCost": "总费用",
    "dashboard.stats.avgTokens": "平均 Token/请求",
    "dashboard.chart.tokenTitle": "Token 消耗趋势",
    "dashboard.chart.costTitle": "费用分布",
    "dashboard.chart.requestTitle": "请求数趋势",
    "dashboard.chart.tooltipTokens": "Token",
    "dashboard.chart.tooltipCost": "费用",
    "dashboard.chart.tooltipRequests": "请求数",
    "dashboard.empty": "暂无使用数据，发起你的第一个 API 请求吧",
    "dashboard.keys.createTitle": "创建 API Key",
    "dashboard.keys.namePlaceholder": "Key 名称（如：生产环境、测试环境）",
    "dashboard.keys.createButton": "创建",
    "dashboard.keys.warning": "请立即保存此 Key — 它不会再显示第二次！",
    "dashboard.keys.yourKeys": "你的 API Key",
    "dashboard.keys.empty": "还没有 API Key，请在上面创建你的第一个 Key",
    "dashboard.keys.usageHint": "使用方式：Authorization: Bearer camellia-你的key",
    "dashboard.keys.disabledBadge": "已禁用",
    "dashboard.keys.lastUsed": "最后使用：{date}",
    "dashboard.keys.deleteTooltip": "删除 Key",
    "dashboard.keys.deleteConfirm": "确定要删除此 Key 吗？所有正在使用它的请求都将失败。",
    "dashboard.toast.keyCreated": "API Key 已创建",
    "dashboard.toast.copied": "已复制到剪贴板",
    "dashboard.toast.keyDeleted": "API Key 已删除",
    "dashboard.plan.tokens": "{n} Tokens/天",

    // --- Admin Page ---
    "admin.title": "管理后台",
    "admin.tabs.overview": "概览",
    "admin.tabs.users": "用户",
    "admin.tabs.channels": "渠道",
    "admin.tabs.pricing": "定价",
    "admin.tabs.billing": "计费",
    "admin.tabDesc.overview": "系统概览与核心指标",
    "admin.tabDesc.users": "管理用户与权限",
    "admin.tabDesc.channels": "上游 API 渠道池管理",
    "admin.tabDesc.pricing": "模型定价配置",
    "admin.tabDesc.billing": "计费流水与交易日志",
    "admin.sidebar.title": "管理面板",
    "admin.sidebar.overview": "概览",
    "admin.sidebar.users": "用户管理",
    "admin.sidebar.channels": "渠道管理",
    "admin.sidebar.pricing": "定价配置",
    "admin.sidebar.billing": "计费日志",

    // Admin Overview
    "admin.overview.totalUsers": "用户总数",
    "admin.overview.activeChannels": "活跃渠道",
    "admin.overview.todayRevenue": "今日收入",
    "admin.overview.todayTokens": "今日 Token",
    "admin.overview.systemStatus": "系统状态",
    "admin.overview.allOk": "所有系统运行正常. 今日请求数: {n}",
    "admin.overview.error": "获取统计数据失败",

    // Admin Users
    "admin.users.searchPlaceholder": "搜索用户...",
    "admin.users.colEmail": "邮箱",
    "admin.users.colName": "名称",
    "admin.users.colRole": "角色",
    "admin.users.colPlan": "套餐",
    "admin.users.colStatus": "状态",
    "admin.users.colBalance": "余额",
    "admin.users.colActions": "操作",
    "admin.users.noUsers": "暂无用户数据",
    "admin.users.enable": "启用",
    "admin.users.disable": "禁用",
    "admin.toast.userEnabled": "用户已启用",
    "admin.toast.userDisabled": "用户已禁用",

    // Admin Channels
    "admin.channels.newChannel": "新增渠道",
    "admin.channels.formTitle": "新建渠道",
    "admin.channels.nameLabel": "名称 *",
    "admin.channels.namePlaceholder": "例：OpenAI-生产-1",
    "admin.channels.providerLabel": "供应商",
    "admin.channels.apiKeyLabel": "API Key *",
    "admin.channels.apiKeyPlaceholder": "sk-...",
    "admin.channels.baseUrlLabel": "Base URL *",
    "admin.channels.baseUrlPlaceholder": "https://api.openai.com",
    "admin.channels.modelsLabel": "模型列表（逗号分隔）",
    "admin.channels.modelsPlaceholder": "gpt-4o-mini,gpt-4o",
    "admin.channels.weightLabel": "权重",
    "admin.channels.priorityLabel": "优先级",
    "admin.channels.concurrencyLabel": "最大并发数",
    "admin.channels.createButton": "创建渠道",
    "admin.channels.colName": "名称",
    "admin.channels.colProvider": "供应商",
    "admin.channels.colModels": "模型",
    "admin.channels.colStatus": "状态",
    "admin.channels.colWeight": "权重",
    "admin.channels.colConcurrency": "并发",
    "admin.channels.colActions": "操作",
    "admin.channels.deleteTooltip": "删除渠道",
    "admin.channels.empty": "尚未配置渠道，请添加你的第一个上游 API Key",
    "admin.channels.deleteConfirm": "确定要删除此渠道吗？",
    "admin.toast.channelCreated": "渠道已创建",
    "admin.toast.channelDeleted": "渠道已删除",

    // Admin Pricing
    "admin.pricing.newPricing": "新增定价",
    "admin.pricing.formTitleNew": "新建定价",
    "admin.pricing.formTitleEdit": "编辑定价",
    "admin.pricing.modelNameLabel": "模型名称 *",
    "admin.pricing.modelNamePlaceholder": "gpt-4o",
    "admin.pricing.displayNameLabel": "显示名称",
    "admin.pricing.displayNamePlaceholder": "GPT-4o",
    "admin.pricing.costInputLabel": "成本输入价 ($/1K tokens)",
    "admin.pricing.costOutputLabel": "成本输出价 ($/1K tokens)",
    "admin.pricing.sellInputLabel": "售价输入 ($/1K tokens)",
    "admin.pricing.sellOutputLabel": "售价输出 ($/1K tokens)",
    "admin.pricing.vipDiscountLabel": "VIP 折扣",
    "admin.pricing.enterpriseDiscountLabel": "企业折扣",
    "admin.pricing.createButton": "创建定价",
    "admin.pricing.updateButton": "更新定价",
    "admin.pricing.colModel": "模型",
    "admin.pricing.colSellIn": "售价输入 ($/1K)",
    "admin.pricing.colSellOut": "售价输出 ($/1K)",
    "admin.pricing.colCostIn": "成本输入 ($/1K)",
    "admin.pricing.colMargin": "利润率",
    "admin.pricing.colActive": "启用",
    "admin.pricing.colActions": "操作",
    "admin.pricing.empty": "尚未配置定价，添加模型定价以启用计费功能",
    "admin.toast.pricingUpdated": "定价已更新",
    "admin.toast.pricingAdded": "定价已添加",
    "admin.toast.pricingDeactivated": "已停用",
    "admin.toast.pricingActivated": "已启用",

    // Admin Billing
    "admin.billing.colTime": "时间",
    "admin.billing.colUser": "用户",
    "admin.billing.colModel": "模型",
    "admin.billing.colTokens": "Token",
    "admin.billing.colCost": "费用",
    "admin.billing.colBalance": "余额",
    "admin.billing.colStatus": "状态",
    "admin.billing.empty": "暂无计费记录",

    // --- Email ---
    "email.subject": "Camellia — 验证码",
    "email.title": "Camellia",
    "email.body": "你的验证码：",
    "email.footer": "此验证码 10 分钟内有效。如果你未请求此验证码，请忽略此邮件。",
    "email.devLog": "[DEV] 验证码 for {email}: {code}",

    // --- API Error Messages ---
    "error.invalidEmail": "邮箱格式无效",
    "error.emailSendFailed": "邮件发送失败",
    "error.internalError": "服务器内部错误",
    "error.emailCodeRequired": "邮箱和验证码为必填项",
    "error.invalidOrExpiredCode": "验证码无效或已过期",
    "error.incorrectCode": "验证码错误",
    "error.accountDisabled": "账号已被禁用",
    "error.unauthorized": "未授权",
    "error.userNotFound": "用户不存在",
    "error.forbidden": "无权限",
    "error.invalidParams": "参数无效",
    "error.channelFieldsRequired": "名称、API Key 和 Base URL 为必填项",
    "error.idRequired": "ID 为必填项",
    "error.modelNameRequired": "模型名称为必填项",
    "error.failedToCreateKey": "创建 Key 失败",
    "error.invalidPlan": "无效的套餐",
    "error.invalidPayload": "无效的请求数据",
  },

  en: {
    // --- Billing Page ---
    "billing.title": "Billing Center",
    "billing.package.5m": "5M Tokens",
    "billing.package.10m": "10M Tokens",
    "billing.package.50m": "50M Tokens",
    "billing.package.100m": "100M Tokens",
    "billing.package.5m.desc": "For individual developers",
    "billing.package.10m.desc": "For small teams",
    "billing.package.50m.desc": "For startups",
    "billing.package.100m.desc": "For enterprises",
    "billing.buy": "Buy Now",
    "billing.alipay": "Pay with Alipay",
    "billing.currentBalance": "Current Balance",
    "billing.orderSummary": "Order Summary",
    "billing.selectPackage": "Select Package",
    "billing.payment": "Payment Method",
    "billing.transactionHistory": "Transaction History",
    "billing.emptyHistory": "No transaction history",
    "billing.scanQR": "Please scan the QR code below to pay",
    "billing.perTokenRate": "Rate per 1K tokens",
    "billing.packagePrice": "Package Price",
    "billing.total": "Total",

    // --- Settings Page ---
    "settings.title": "Settings",
    "settings.profile": "Profile",
    "settings.nickname": "Nickname",
    "settings.save": "Save",
    "settings.saved": "Saved",
    "settings.stats": "Account Stats",
    "settings.registeredAt": "Registered",
    "settings.totalTokens": "Total Tokens",
    "settings.totalCost": "Total Spent",
    "settings.language": "Language Preference",
    "settings.password": "Change Password",
    "settings.comingSoon": "Coming Soon",

    // --- Common / Shared ---
    "app.title": "Camellia — Enterprise API Orchestration",
    "app.description": "High-performance LLM API gateway with load balancing, channel pool management, and usage-based billing.",
    "app.keywords": "LLM,API Gateway,AI,OpenAI,Load Balancer",
    "common.loading": "Loading...",
    "common.retry": "Retry",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.refresh": "Refresh",
    "common.search": "Search...",
    "common.enable": "Enable",
    "common.disable": "Disable",
    "common.yes": "Yes",
    "common.no": "No",
    "common.active": "Active",
    "common.disabled": "Disabled",
    "common.total": "Total: {n}",
    "common.page": "Page {page} / {total}",
    "common.back": "Back to home",
    "common.noData": "No data found",

    // --- Navbar / Header ---
    "nav.signIn": "Sign In",
    "nav.getStarted": "Get Started",
    "nav.dashboard": "Dashboard",
    "nav.apiKeys": "API Keys",
    "nav.keys": "API Keys",
    "nav.billing": "Billing",
    "nav.settings": "Settings",
    "nav.signOut": "Sign Out",
    "nav.currentPlan": "Current Plan",

    // --- Language Switcher ---
    "lang.switch": "中文",

    // --- Landing Page ---
    "landing.heroBadge": "Enterprise-grade LLM orchestration",
    "landing.heroTitle": "Ship AI features 10x faster with one unified API gateway",
    "landing.heroSubtitle": "Route, load-balance, monitor, and monetize all your LLM APIs from a single platform. Fully OpenAI-compatible.",
    "landing.ctaStart": "Start Building Free",
    "landing.ctaDocs": "View Documentation",
    "landing.featuresTitle": "Everything you need to go live",
    "landing.featuresSubtitle": "Stop reinventing the wheel. We've built it all for you.",
    "landing.feature1Title": "Channel Pool Load Balancing",
    "landing.feature1Desc": "Multi-provider API key management with 3-tier intelligent routing: priority, least-connections, and weighted distribution with auto-failover.",
    "landing.feature2Title": "< 5ms Routing Overhead",
    "landing.feature2Desc": "Built on Go Fiber with 256K concurrent connections. Zero-buffer SSE streaming with sub-millisecond latency.",
    "landing.feature3Title": "Built-in Rate Limiting",
    "landing.feature3Desc": "Five-tier protection: IP → RPM → Concurrency → TPM. Redis-powered Lua atomic operations with sliding window + token bucket.",
    "landing.feature4Title": "Real-time Analytics",
    "landing.feature4Desc": "Token consumption trends and cost charts with 7d/30d toggles. Know exactly where every cent goes.",
    "landing.feature5Title": "API Key Management",
    "landing.feature5Desc": "SHA-256 hashed storage, prefix display, show-once-on-creation. Auto-synced to Redis cache for sub-ms auth.",
    "landing.feature6Title": "Fully OpenAI Compatible",
    "landing.feature6Desc": "Drop-in replacement — just change the base_url. Supports Chat Completions, Embeddings, and Models endpoints.",
    "landing.ctaBottomTitle": "Ready to deploy?",
    "landing.ctaBottomDesc": "Get API keys in under 2 minutes. No credit card required.",
    "landing.ctaBottomButton": "Create Free Account",
    "landing.footer": "© Camellia. Built for builders.",
    "landing.chartTitle": "API Usage — Last 30 days",
    "landing.chartTokens": "{n}K tokens",
    "landing.chartDateRange": "Jun 1 - Jun 30",

    // --- Login Page ---
    "login.title": "Sign in",
    "login.checkEmail": "Check your email",
    "login.subtitle": "Enter your email to receive a verification code. New accounts are created automatically.",
    "login.codeSent": "We sent a 6-digit code to {email}",
    "login.emailLabel": "Email address",
    "login.emailPlaceholder": "you@company.com",
    "login.sendCode": "Send Code",
    "login.codeLabel": "Verification code",
    "login.codePlaceholder": "000000",
    "login.verifySignIn": "Verify & Sign In",
    "login.differentEmail": "Use a different email",
    "login.terms": "By continuing, you agree to our Terms of Service and Privacy Policy.",
    "login.toast.invalidEmail": "Please enter a valid email address",
    "login.toast.codeSent": "Verification code sent to your email",
    "login.toast.sendFailed": "Failed to send code",
    "login.toast.invalidCode": "Please enter a 6-digit code",
    "login.toast.welcome": "Welcome",
    "login.toast.welcomeName": ", {name}",
    "login.toast.welcomeDefault": "!",
    "login.toast.invalidCodeError": "Invalid code",
    "login.passwordLabel": "Password",
    "login.passwordPlaceholder": "Enter password",
    "login.usernameLabel": "Username",
    "login.usernamePlaceholder": "3-30 chars, alphanumeric or Chinese",
    "login.confirmPasswordLabel": "Confirm Password",
    "login.loginButton": "Sign In",
    "login.registerButton": "Register",
    "login.tabLogin": "Sign In",
    "login.tabRegister": "Register",
    "login.toast.passwordMismatch": "Passwords do not match",
    "login.toast.passwordTooShort": "Password must be at least 6 chars",
    "login.toast.usernameInvalid": "Username must be 3-30 chars",
    "login.toast.registerSuccess": "Registered successfully! Welcome",
    "login.toast.loginFailed": "Invalid email/username or password",

    // --- Dashboard Page ---
    "dashboard.title": "Dashboard",
    "dashboard.welcome": "Welcome back, {name}",
    "dashboard.tabs.usage": "Usage",
    "dashboard.tabs.keys": "API Keys",
    "dashboard.period.7days": "7 Days",
    "dashboard.period.30days": "30 Days",
    "dashboard.stats.totalTokens": "Total Tokens",
    "dashboard.stats.totalRequests": "Total Requests",
    "dashboard.stats.totalCost": "Total Cost",
    "dashboard.stats.avgTokens": "Avg. Tokens/Req",
    "dashboard.chart.tokenTitle": "Token Consumption",
    "dashboard.chart.costTitle": "Cost Breakdown",
    "dashboard.chart.requestTitle": "Request Count",
    "dashboard.chart.tooltipTokens": "Tokens",
    "dashboard.chart.tooltipCost": "Cost",
    "dashboard.chart.tooltipRequests": "Requests",
    "dashboard.empty": "No usage data yet. Make your first API request.",
    "dashboard.keys.createTitle": "Create API Key",
    "dashboard.keys.namePlaceholder": "Key name (e.g. Production, Staging)",
    "dashboard.keys.createButton": "Create",
    "dashboard.keys.warning": "Save this key — it won't be shown again!",
    "dashboard.keys.yourKeys": "Your API Keys",
    "dashboard.keys.empty": "No API keys yet. Create your first key above.",
    "dashboard.keys.usageHint": "Use it with: Authorization: Bearer camellia-your-key",
    "dashboard.keys.disabledBadge": "Disabled",
    "dashboard.keys.lastUsed": "Last used: {date}",
    "dashboard.keys.deleteTooltip": "Delete key",
    "dashboard.keys.deleteConfirm": "Delete this key? All requests using it will fail.",
    "dashboard.toast.keyCreated": "API key created",
    "dashboard.toast.copied": "Copied to clipboard",
    "dashboard.toast.keyDeleted": "API key deleted",
    "dashboard.plan.tokens": "{n} tokens/day",

    // --- Admin Page ---
    "admin.title": "Admin Console",
    "admin.tabs.overview": "Overview",
    "admin.tabs.users": "Users",
    "admin.tabs.channels": "Channels",
    "admin.tabs.pricing": "Pricing",
    "admin.tabs.billing": "Billing",
    "admin.tabDesc.overview": "System overview and key metrics",
    "admin.tabDesc.users": "Manage users and permissions",
    "admin.tabDesc.channels": "Upstream API channel pool management",
    "admin.tabDesc.pricing": "Model pricing configuration",
    "admin.tabDesc.billing": "Billing ledger and transaction logs",
    "admin.sidebar.title": "Admin Panel",
    "admin.sidebar.overview": "Overview",
    "admin.sidebar.users": "Users",
    "admin.sidebar.channels": "Channels",
    "admin.sidebar.pricing": "Pricing",
    "admin.sidebar.billing": "Billing Logs",

    // Admin Overview
    "admin.overview.totalUsers": "Total Users",
    "admin.overview.activeChannels": "Active Channels",
    "admin.overview.todayRevenue": "Today Revenue",
    "admin.overview.todayTokens": "Today Tokens",
    "admin.overview.systemStatus": "System Status",
    "admin.overview.allOk": "All systems operational. Total requests today: {n}",
    "admin.overview.error": "Failed to fetch stats",

    // Admin Users
    "admin.users.searchPlaceholder": "Search users...",
    "admin.users.colEmail": "Email",
    "admin.users.colName": "Name",
    "admin.users.colRole": "Role",
    "admin.users.colPlan": "Plan",
    "admin.users.colStatus": "Status",
    "admin.users.colBalance": "Balance",
    "admin.users.colActions": "Actions",
    "admin.users.noUsers": "No users found.",
    "admin.users.enable": "Enable",
    "admin.users.disable": "Disable",
    "admin.toast.userEnabled": "User enabled",
    "admin.toast.userDisabled": "User disabled",

    // Admin Channels
    "admin.channels.newChannel": "Add Channel",
    "admin.channels.formTitle": "New Channel",
    "admin.channels.nameLabel": "Name *",
    "admin.channels.namePlaceholder": "e.g. OpenAI-Prod-1",
    "admin.channels.providerLabel": "Provider",
    "admin.channels.apiKeyLabel": "API Key *",
    "admin.channels.apiKeyPlaceholder": "sk-...",
    "admin.channels.baseUrlLabel": "Base URL *",
    "admin.channels.baseUrlPlaceholder": "https://api.openai.com",
    "admin.channels.modelsLabel": "Models (comma-separated)",
    "admin.channels.modelsPlaceholder": "gpt-4o-mini,gpt-4o",
    "admin.channels.weightLabel": "Weight",
    "admin.channels.priorityLabel": "Priority",
    "admin.channels.concurrencyLabel": "Max Concurrency",
    "admin.channels.createButton": "Create Channel",
    "admin.channels.colName": "Name",
    "admin.channels.colProvider": "Provider",
    "admin.channels.colModels": "Models",
    "admin.channels.colStatus": "Status",
    "admin.channels.colWeight": "Weight",
    "admin.channels.colConcurrency": "Concurrency",
    "admin.channels.colActions": "Actions",
    "admin.channels.deleteTooltip": "Delete channel",
    "admin.channels.empty": "No channels configured. Add your first upstream API key.",
    "admin.channels.deleteConfirm": "Delete this channel?",
    "admin.toast.channelCreated": "Channel created",
    "admin.toast.channelDeleted": "Channel deleted",

    // Admin Pricing
    "admin.pricing.newPricing": "Add Model Pricing",
    "admin.pricing.formTitleNew": "New Pricing",
    "admin.pricing.formTitleEdit": "Edit Pricing",
    "admin.pricing.modelNameLabel": "Model Name *",
    "admin.pricing.modelNamePlaceholder": "gpt-4o",
    "admin.pricing.displayNameLabel": "Display Name",
    "admin.pricing.displayNamePlaceholder": "GPT-4o",
    "admin.pricing.costInputLabel": "Cost Input ($/1K tokens)",
    "admin.pricing.costOutputLabel": "Cost Output ($/1K tokens)",
    "admin.pricing.sellInputLabel": "Sell Input ($/1K tokens)",
    "admin.pricing.sellOutputLabel": "Sell Output ($/1K tokens)",
    "admin.pricing.vipDiscountLabel": "VIP Discount",
    "admin.pricing.enterpriseDiscountLabel": "Enterprise Discount",
    "admin.pricing.createButton": "Create Pricing",
    "admin.pricing.updateButton": "Update Pricing",
    "admin.pricing.colModel": "Model",
    "admin.pricing.colSellIn": "Sell In ($/1K)",
    "admin.pricing.colSellOut": "Sell Out ($/1K)",
    "admin.pricing.colCostIn": "Cost In ($/1K)",
    "admin.pricing.colMargin": "Margin",
    "admin.pricing.colActive": "Active",
    "admin.pricing.colActions": "Actions",
    "admin.pricing.empty": "No pricing configured. Add model pricing to enable billing.",
    "admin.toast.pricingUpdated": "Pricing updated",
    "admin.toast.pricingAdded": "Pricing added",
    "admin.toast.pricingDeactivated": "Deactivated",
    "admin.toast.pricingActivated": "Activated",

    // Admin Billing
    "admin.billing.colTime": "Time",
    "admin.billing.colUser": "User",
    "admin.billing.colModel": "Model",
    "admin.billing.colTokens": "Tokens",
    "admin.billing.colCost": "Cost",
    "admin.billing.colBalance": "Balance",
    "admin.billing.colStatus": "Status",
    "admin.billing.empty": "No billing records yet.",

    // --- Email ---
    "email.subject": "Camellia — Verification Code",
    "email.title": "Camellia",
    "email.body": "Your verification code:",
    "email.footer": "This code expires in 10 minutes. If you didn't request this, ignore this email.",
    "email.devLog": "[DEV] Verification code for {email}: {code}",

    // --- API Error Messages ---
    "error.invalidEmail": "Invalid email",
    "error.emailSendFailed": "Failed to send email",
    "error.internalError": "Internal server error",
    "error.emailCodeRequired": "Email and code required",
    "error.invalidOrExpiredCode": "Invalid or expired code",
    "error.incorrectCode": "Incorrect code",
    "error.accountDisabled": "Account disabled",
    "error.unauthorized": "Unauthorized",
    "error.userNotFound": "User not found",
    "error.forbidden": "Forbidden",
    "error.invalidParams": "Invalid params",
    "error.channelFieldsRequired": "name, api_key, and base_url are required",
    "error.idRequired": "id required",
    "error.modelNameRequired": "model_name required",
    "error.failedToCreateKey": "Failed to create key",
    "error.invalidPlan": "Invalid plan",
    "error.invalidPayload": "Invalid payload",
  },
}

// ============================================================
// Context & Hook
// ============================================================

interface I18nContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType>({
  lang: "zh",
  setLang: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    // Always default to Chinese on first render
    // Only load from localStorage if user explicitly chose "en" before
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("camellia_lang")
      if (stored === "en") return "en"
    }
    return "zh"
  })

  // Sync with localStorage on mount (one-time after hydration)
  useEffect(() => {
    const stored = localStorage.getItem("camellia_lang")
    if (stored === "en") {
      setLangState("en")
    } else {
      // Force Chinese for everything else (including null, invalid values, "zh")
      localStorage.setItem("camellia_lang", "zh")
    }
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem("camellia_lang", l)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = translations[lang]
      let text = dict[key]
      if (text === undefined) {
        // Fallback to English if key missing in current language
        text = translations["en"][key] ?? key
      }
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }
      return text
    },
    [lang]
  )

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
