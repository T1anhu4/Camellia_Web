"use client"

import { useState } from "react"
import Link from "next/link"
import { Copy, Check, ChevronRight } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { NavBar } from "@/components/layout/nav-bar"
import { cn } from "@/lib/utils"

type Lang = "python" | "javascript" | "go" | "java" | "curl"

const codeExamples: Record<Lang, { template: (key: string) => string; title: string }> = {
  curl: {
    title: "cURL",
    template: (key) => `curl https://api.camellia.online/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'`,
  },
  python: {
    title: "Python",
    template: (key) => `import requests

url = "https://api.camellia.online/v1/chat/completions"
headers = {
    "Authorization": "Bearer ${key}",
    "Content-Type": "application/json"
}
data = {
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": False
}

response = requests.post(url, headers=headers, json=data)
print(response.json()["choices"][0]["message"]["content"])`,
  },
  javascript: {
    title: "JavaScript",
    template: (key) => `const response = await fetch("https://api.camellia.online/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${key}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello!" }],
    stream: false
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);`,
  },
  go: {
    title: "Go",
    template: (key) => `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    body := map[string]interface{}{
        "model": "gpt-4o-mini",
        "messages": []map[string]string{
            {"role": "user", "content": "Hello!"},
        },
    }
    jsonBody, _ := json.Marshal(body)

    req, _ := http.NewRequest("POST",
        "https://api.camellia.online/v1/chat/completions",
        bytes.NewReader(jsonBody))
    req.Header.Set("Authorization", "Bearer ${key}")
    req.Header.Set("Content-Type", "application/json")

    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    choices := result["choices"].([]interface{})
    msg := choices[0].(map[string]interface{})["message"]
    fmt.Println(msg.(map[string]interface{})["content"])
}`,
  },
  java: {
    title: "Java",
    template: (key) => `import java.net.URI;
import java.net.http.*;

public class CamelliaChat {
    public static void main(String[] args) throws Exception {
        var client = HttpClient.newHttpClient();
        var json = """
            {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": "Hello!"}]
            }
            """;

        var request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.camellia.online/v1/chat/completions"))
            .header("Authorization", "Bearer ${key}")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();

        var response = client.send(request,
            HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}`,
  },
}

const endpoints = [
  { method: "POST", path: "/v1/chat/completions", desc: "Chat completions — send messages, get AI responses. Supports streaming via SSE." },
  { method: "POST", path: "/v1/embeddings", desc: "Embeddings — convert text into vector representations for semantic search." },
  { method: "GET", path: "/v1/models", desc: "List all available models in your account." },
]

export default function DocsPage() {
  const { t, lang } = useI18n()
  const [langTab, setLangTab] = useState<Lang>("python")
  const [copied, setCopied] = useState(false)
  const [keyPlaceholder] = useState("camellia-YOUR-API-KEY")

  const copyCode = () => {
    const code = codeExamples[langTab].template(keyPlaceholder)
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isZH = lang === "zh"

  return (
    <main className="min-h-screen bg-surface-50">
      <NavBar />
      <div className="container-page section-py pt-[100px] md:pt-[120px]">
        <div className="grid lg:grid-cols-[240px_1fr] gap-10">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky top-[100px] space-y-1">
              <div className="font-bold text-sm mb-3">Documentation</div>
              {[{ href: "#intro", label: isZH ? "简介" : "Introduction" },
                { href: "#quickstart", label: isZH ? "快速开始" : "Quickstart" },
                { href: "#auth", label: "Authentication" },
                { href: "#endpoints", label: "API Endpoints" },
                { href: "#code", label: isZH ? "代码示例" : "Code Examples" }].map(item => (
                <a key={item.href} href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-600 hover:text-surface-950 hover:bg-surface-100 transition-colors">
                  <ChevronRight className="w-3 h-3" />{item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="max-w-3xl">
            <div className="section-header">{isZH ? "文档" : "Documentation"}</div>
            <h1 id="intro" className="section-title mt-3 mb-6">{isZH ? "Camellia API 文档" : "Camellia API Docs"}</h1>

            <p className="text-surface-700 leading-relaxed mb-8">
              {isZH
                ? "Camellia 是一个完整兼容 OpenAI API 协议的大模型调度平台。只需修改 base_url，无需改动任何代码即可从 OpenAI 切换到 Camellia。"
                : "Camellia is an LLM orchestration platform fully compatible with the OpenAI API. Just change your base_url — no code changes needed."}
            </p>

            {/* Quickstart */}
            <section id="quickstart" className="mb-12">
              <h2 className="text-[24px] font-bold mb-4">{isZH ? "快速开始" : "Quickstart"}</h2>
              <ol className="space-y-3 text-surface-700">
                <li className="flex gap-3"><span className="font-bold shrink-0">1.</span>{isZH ? "注册 Camellia 账号并创建 API Key。" : "Register a Camellia account and create an API Key."}</li>
                <li className="flex gap-3"><span className="font-bold shrink-0">2.</span>{isZH ? "将 OpenAI SDK 的 base_url 替换为 https://api.camellia.online/v1" : "Replace the OpenAI SDK base_url with https://api.camellia.online/v1"}</li>
                <li className="flex gap-3"><span className="font-bold shrink-0">3.</span>{isZH ? "将 API Key 设置为你的 Camellia API Key。" : "Set your API key to your Camellia API Key."}</li>
                <li className="flex gap-3"><span className="font-bold shrink-0">4.</span>{isZH ? "开始调用！所有模型通过同一个 API Key 和同一个 endpoint 访问。" : "Start calling! All models accessible via the same API key and endpoint."}</li>
              </ol>
            </section>

            {/* Auth */}
            <section id="auth" className="mb-12">
              <h2 className="text-[24px] font-bold mb-4">Authentication</h2>
              <p className="text-surface-700 mb-4">
                {isZH
                  ? "所有 API 请求需通过 HTTP Authorization Header 携带 API Key："
                  : "All API requests must include your API key in the HTTP Authorization header:"}
              </p>
              <div className="card bg-surface-50 p-4 font-mono text-sm mb-4">
                Authorization: Bearer camellia-YOUR-API-KEY
              </div>
              <p className="text-surface-600 text-sm">
                {isZH
                  ? "API Key 在控制台创建后仅展示一次，请妥善保管。丢失后可重新创建。"
                  : "API keys are shown once upon creation. Store them securely."}
              </p>
            </section>

            {/* Endpoints */}
            <section id="endpoints" className="mb-12">
              <h2 className="text-[24px] font-bold mb-4">API Endpoints</h2>
              <div className="space-y-3">
                {endpoints.map(ep => (
                  <div key={ep.path} className="card bg-white p-4 md:p-5 flex items-start gap-4">
                    <span className="font-mono text-xs font-bold bg-surface-950 text-white px-2 py-1 rounded-md uppercase shrink-0">{ep.method}</span>
                    <div>
                      <div className="font-mono font-bold text-sm mb-1">{ep.path}</div>
                      <div className="text-surface-600 text-sm">{ep.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Code */}
            <section id="code" className="mb-12">
              <h2 className="text-[24px] font-bold mb-4">{isZH ? "代码示例" : "Code Examples"}</h2>
              <p className="text-surface-700 mb-6">
                {isZH
                  ? "以下展示了如何使用不同语言调用 Camellia API。将 YOUR-API-KEY 替换为你的实际 API Key。"
                  : "Examples in various languages. Replace YOUR-API-KEY with your actual key."}
              </p>

              {/* Lang tabs */}
              <div className="flex flex-wrap gap-1 mb-0 bg-surface-100 rounded-lg p-1">
                {(Object.keys(codeExamples) as Lang[]).map(l => (
                  <button key={l} onClick={() => setLangTab(l)}
                    className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                      langTab === l ? "bg-surface-950 text-white" : "text-surface-600 hover:text-surface-950")}>
                    {codeExamples[l].title}
                  </button>
                ))}
              </div>

              {/* Code block */}
              <div className="relative bg-surface-950 text-surface-100 rounded-b-[16px] rounded-tr-[16px] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-surface-900 text-surface-400 text-xs">
                  <span>{codeExamples[langTab].title}</span>
                  <button onClick={copyCode} className="flex items-center gap-1 hover:text-white transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? (isZH ? "已复制" : "Copied") : "Copy"}
                  </button>
                </div>
                <pre className="p-4 md:p-6 overflow-x-auto text-xs md:text-sm leading-relaxed">
                  <code>{codeExamples[langTab].template(keyPlaceholder)}</code>
                </pre>
              </div>

              {/* OpenAI SDK compatibility */}
              <div className="mt-6 card bg-blue-50/50 border border-blue-100 p-5">
                <h3 className="font-bold mb-2">{isZH ? "OpenAI SDK 直接兼容" : "Direct OpenAI SDK Compatible"}</h3>
                <p className="text-surface-700 text-sm mb-3">
                  {isZH
                    ? "如果你已经在使用 OpenAI SDK，只需修改 base_url 和 api_key："
                    : "If you already use the OpenAI SDK, just change base_url and api_key:"}
                </p>
                <div className="bg-surface-950 text-surface-100 rounded-xl p-4 font-mono text-xs md:text-sm overflow-x-auto">
                  <code>{`from openai import OpenAI

client = OpenAI(
    base_url="https://api.camellia.online/v1",  # 改这里
    api_key="camellia-YOUR-API-KEY"              # 和这里
)

# 其余代码完全不变
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`}</code>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
