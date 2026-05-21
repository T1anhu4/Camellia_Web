const RESEND_API = "https://api.resend.com/emails"

// Resend default sender — always works even without domain verification
const RESEND_DEFAULT_FROM = "Camellia <onboarding@resend.dev>"

function getApiKey(): string | null {
  return process.env.RESEND_API_KEY || null
}

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error("[Camellia] RESEND_API_KEY not configured — email disabled")
    return false
  }

  // Custom domain from env (e.g. Camellia <noreply@camellia.ai> or <noreply@camellia.online>)
  const customFrom = process.env.EMAIL_FROM || ""

  // Dual-send strategy:
  // 1. Try custom domain first (if configured)
  // 2. Fallback to Resend default sender (always works)
  const senders: string[] = []
  if (customFrom && customFrom !== RESEND_DEFAULT_FROM) {
    senders.push(customFrom)
  }
  senders.push(RESEND_DEFAULT_FROM)

  for (const from of senders) {
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [to], subject, html }),
      })

      if (res.ok) {
        console.log(`[Camellia] Email sent via ${from} to ${to}`)
        return true
      }

      const errBody = await res.json().catch(() => ({}))
      console.warn(`[Camellia] Failed with sender ${from}:`, errBody)
      // Continue to next sender
    } catch (err) {
      console.warn(`[Camellia] Error with sender ${from}:`, err)
    }
  }

  console.error(`[Camellia] All senders failed for ${to}`)
  return false
}

export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.log(`[Camellia] DEV MODE — No Resend API key. Verification code for ${email}: ${code}`)
    return false
  }

  return sendEmail(email, "Camellia — 验证码", buildCodeEmail(code))
}

export async function sendWelcomeEmail(email: string, username: string): Promise<boolean> {
  return sendEmail(email, "欢迎加入 Camellia", buildWelcomeEmail(username))
}

function buildCodeEmail(code: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px">
      <h2 style="color:#6366f1;margin:0 0 4px">Camellia</h2>
      <p style="font-size:13px;color:#64748b;margin:0 0 20px">山茶花 · 大模型 API 调度平台</p>
      <p style="font-size:16px;color:#94a3b8;margin:0 0 24px">你的验证码：</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:12px;text-align:center;color:#e2e8f0;background:#1e293b;border-radius:12px;padding:16px;margin:0 0 24px">
        ${code}
      </div>
      <p style="font-size:13px;color:#64748b;margin:0">此验证码 10 分钟内有效。如果未请求此验证码，请忽略此邮件。</p>
    </div>
  `
}

function buildWelcomeEmail(username: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px">
      <h2 style="color:#6366f1;margin:0 0 4px">Camellia</h2>
      <p style="font-size:16px;color:#94a3b8;margin:0 0 24px">欢迎 ${username}！</p>
      <p style="font-size:14px;color:#94a3b8;margin:0 0 16px">你的账户已创建成功。现在可以：</p>
      <ul style="color:#94a3b8;font-size:14px;margin:0 0 24px;padding-left:20px">
        <li>创建 API Key 开始调用大模型</li>
        <li>查看用量统计和费用明细</li>
        <li>配置上游渠道接入自己的 API Key</li>
      </ul>
      <a href="https://camellia.ai/dashboard" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">进入控制台</a>
    </div>
  `
}
