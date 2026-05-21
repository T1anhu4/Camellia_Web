import type { ReactNode } from "react"

export interface ModelMeta {
  name: string; provider: string; providerLabel: string
  description: string; descriptionZH: string
  contextWindow: string; maxOutput: string
  inputPrice: string; outputPrice: string
  inputTypes: ("text"|"image"|"file"|"video"|"voice")[]
  outputTypes: ("text"|"image"|"file"|"video"|"voice")[]
  logo: (size?: number) => ReactNode
}

function OpenAILogo(s?: number) { const z = s || 28; return <svg width={z} height={z} viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><rect width="24" height="24" rx="6" fill="#10a37f"/><path d="M16.5 8.5c-.6-1.2-1.8-2-3-2-1.2 0-2.4.8-3 2l-3.5 7c-.3.6-.9 1-1.5 1-.5 0-1-.4-1.3-.8.3-.2.6-.6.7-1 .1-.4 0-.8-.3-1.1-.3-.3-.7-.4-1.1-.3-.4.1-.8.4-1 .7-.4.7-.2 1.6.4 2.1.6.5 1.4.7 2.1.4.7-.3 1.3-.9 1.6-1.6l3.5-7c.3-.6.9-1 1.5-1 .5 0 1 .4 1.3.8-.3.2-.6.6-.7 1-.1.4 0 .8.3 1.1.3.3.7.4 1.1.3.4-.1.8-.4 1-.7.4-.7.2-1.6-.4-2.1z" fill="#fff"/></svg> }
function AnthropicLogo(s?: number) { const z = s || 28; return <svg width={z} height={z} viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><rect width="24" height="24" rx="6" fill="#d97757"/><path d="M15.5 5H8.5L5 12l3.5 7h7l3.5-7-3.5-7zm-7 7l3.5-5.5 3.5 5.5-3.5 5.5L8.5 12z" fill="#fff"/></svg> }
function GoogleLogo(s?: number) { const z = s || 28; return <svg width={z} height={z} viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><rect width="24" height="24" rx="6" fill="#4285f4"/><path d="M12 5c1.6 0 3 .6 4.1 1.6l3-3C17.2 2 14.8 1 12 1 8.5 1 5.4 2.9 3.6 5.7l3.7 2.9C8 6.5 9.8 5 12 5z" fill="#fff"/><path d="M20.3 10H12v4h4.8c-.5 1.5-1.8 2.5-3.3 2.5-2 0-3.6-1.6-3.6-3.6 0-2 1.6-3.6 3.6-3.6.9 0 1.7.3 2.3.9l2.9-2.9C17.1 5.4 14.7 4.3 12 4.3 7.2 4.3 3.3 8.2 3.3 13s3.9 8.7 8.7 8.7c4.3 0 7.9-3.1 8.5-7.1.1-.5.1-1.1.1-1.6 0-.8-.1-1.6-.3-2.3H12v.3z" fill="#fff"/></svg> }
function LetterLogo(l: string, bg: string, s = 28) { return <div style={{width:s,height:s,borderRadius:8,background:bg,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:s*0.45,flexShrink:0}}>{l}</div> }
function DefaultLogo(s?: number) { return LetterLogo("AI", "#64748b", s) }
function DeepSeekLogo(s?: number) { return LetterLogo("D", "#4d6bfe", s) }
function QwenLogo(s?: number) { return LetterLogo("Q", "#6b4cf0", s) }
function MetaLogo(s?: number) { return LetterLogo("M", "#0668e1", s) }
function MistralLogo(s?: number) { return LetterLogo("M", "#f5a623", s) }
function ZhipuLogo(s?: number) { return LetterLogo("Z", "#3056e3", s) }
function BaiduLogo(s?: number) { return LetterLogo("B", "#2932e1", s) }
function XAILogo(s?: number) { return LetterLogo("X", "#000", s) }

const PROVIDER_LOGOS: Record<string, (s?: number) => ReactNode> = {
  openai: OpenAILogo, anthropic: AnthropicLogo, google: GoogleLogo,
  deepseek: DeepSeekLogo, meta: MetaLogo, mistral: MistralLogo, mistralai: MistralLogo,
  qwen: QwenLogo, alibaba: QwenLogo, zhipu: ZhipuLogo, baidu: BaiduLogo,
  xai: XAILogo, "x-ai": XAILogo, custom: DefaultLogo,
}

const MODEL_CATALOG: Record<string, Partial<ModelMeta>> = {
  "gpt-4o": { provider:"openai",providerLabel:"OpenAI",description:"Most advanced multimodal model with superior reasoning across text, vision, and audio.",descriptionZH:"最先进的多模态模型，在文本、视觉和音频推理方面表现卓越。",contextWindow:"128K",maxOutput:"16K",inputPrice:"¥2.50",outputPrice:"¥10.00",inputTypes:["text","image"],outputTypes:["text"] },
  "gpt-4o-mini": { provider:"openai",providerLabel:"OpenAI",description:"Cost-efficient small model for lightweight tasks. Fast and affordable.",descriptionZH:"高性价比小型模型，适合轻量级任务，快速且经济实惠。",contextWindow:"128K",maxOutput:"16K",inputPrice:"¥0.15",outputPrice:"¥0.60",inputTypes:["text","image"],outputTypes:["text"] },
  "gpt-4-turbo": { provider:"openai",providerLabel:"OpenAI",description:"High-intelligence model with vision capabilities.",descriptionZH:"高智能模型，具备视觉能力和改进的指令遵循能力。",contextWindow:"128K",maxOutput:"4K",inputPrice:"¥10.00",outputPrice:"¥30.00",inputTypes:["text","image"],outputTypes:["text"] },
  "gpt-3.5-turbo": { provider:"openai",providerLabel:"OpenAI",description:"Fast, inexpensive model for simple tasks.",descriptionZH:"快速低成本的模型，适合简单任务。",contextWindow:"16K",maxOutput:"4K",inputPrice:"¥0.50",outputPrice:"¥1.50",inputTypes:["text"],outputTypes:["text"] },
  "claude-4-haiku": { provider:"anthropic",providerLabel:"Anthropic",description:"Fastest Claude model, ideal for real-time chat and quick analysis.",descriptionZH:"最快的 Claude 模型，实时对话和快速分析的首选。",contextWindow:"200K",maxOutput:"8K",inputPrice:"¥1.00",outputPrice:"¥5.00",inputTypes:["text","image"],outputTypes:["text"] },
  "claude-4-sonnet": { provider:"anthropic",providerLabel:"Anthropic",description:"Best balance of intelligence and speed for complex reasoning and coding.",descriptionZH:"智能与速度的最佳平衡。复杂推理和编码的理想选择。",contextWindow:"200K",maxOutput:"8K",inputPrice:"¥3.00",outputPrice:"¥15.00",inputTypes:["text","image"],outputTypes:["text"] },
  "claude-4-opus": { provider:"anthropic",providerLabel:"Anthropic",description:"Most powerful Claude for hardest problems — deep research, math, complex coding.",descriptionZH:"最强 Claude 模型，深度研究、数学和复杂编程。",contextWindow:"200K",maxOutput:"8K",inputPrice:"¥15.00",outputPrice:"¥75.00",inputTypes:["text","image"],outputTypes:["text"] },
  "gemini-pro": { provider:"google",providerLabel:"Google",description:"Google mid-tier multimodal model with balanced performance.",descriptionZH:"Google 中端多模态模型，文本和视觉任务性能均衡。",contextWindow:"128K",maxOutput:"8K",inputPrice:"¥1.25",outputPrice:"¥5.00",inputTypes:["text","image","video"],outputTypes:["text"] },
  "gemini-flash": { provider:"google",providerLabel:"Google",description:"Google fast and cost-effective multimodal model.",descriptionZH:"Google 快速高性价比多模态模型。",contextWindow:"128K",maxOutput:"8K",inputPrice:"¥0.15",outputPrice:"¥0.60",inputTypes:["text","image","video"],outputTypes:["text"] },
  "deepseek-chat": { provider:"deepseek",providerLabel:"DeepSeek",description:"DeepSeek general-purpose chat model with strong reasoning at competitive pricing.",descriptionZH:"DeepSeek 通用对话模型，推理能力强，价格极具竞争力。",contextWindow:"64K",maxOutput:"8K",inputPrice:"¥0.14",outputPrice:"¥0.28",inputTypes:["text"],outputTypes:["text"] },
  "deepseek-coder": { provider:"deepseek",providerLabel:"DeepSeek",description:"DeepSeek code-specialized model for programming and debugging.",descriptionZH:"DeepSeek 代码专用模型，擅长编程、调试和技术任务。",contextWindow:"64K",maxOutput:"8K",inputPrice:"¥0.14",outputPrice:"¥0.28",inputTypes:["text"],outputTypes:["text"] },
  "deepseek-v4-pro": { provider:"deepseek",providerLabel:"DeepSeek",description:"DeepSeek V4 Pro — latest flagship with MoE architecture, superior multilingual reasoning.",descriptionZH:"DeepSeek V4 Pro — 最新旗舰 MoE 架构，卓越的多语言推理和长文本处理能力。",contextWindow:"128K",maxOutput:"32K",inputPrice:"¥0.55",outputPrice:"¥2.19",inputTypes:["text"],outputTypes:["text"] },
  "deepseek-v4-flash": { provider:"deepseek",providerLabel:"DeepSeek",description:"DeepSeek V4 Flash — fast, efficient model for high-throughput workloads.",descriptionZH:"DeepSeek V4 Flash — 高效快速模型，适合高吞吐量生产环境。",contextWindow:"128K",maxOutput:"16K",inputPrice:"¥0.14",outputPrice:"¥0.28",inputTypes:["text"],outputTypes:["text"] },
  "qwen3.5": { provider:"qwen",providerLabel:"Qwen / Alibaba",description:"Alibaba Qwen series — strong multilingual model.",descriptionZH:"阿里巴巴通义千问系列，多语言能力强。",contextWindow:"128K",maxOutput:"8K",inputPrice:"¥0.50",outputPrice:"¥2.00",inputTypes:["text","image"],outputTypes:["text"] },
}

export function getModelMeta(modelName: string): ModelMeta {
  const n = modelName.toLowerCase().trim()
  const cat = MODEL_CATALOG[n] || {}
  const provider = cat.provider || guessProvider(n)
  const plabel = cat.providerLabel || provider.charAt(0).toUpperCase() + provider.slice(1)
  return {
    name: modelName, provider, providerLabel: plabel,
    description: cat.description || plabel + " model — high-performance LLM accessible via Camellia API.",
    descriptionZH: cat.descriptionZH || plabel + " 模型 — 通过 Camellia API 调用高性能大语言模型。",
    contextWindow: cat.contextWindow || "—", maxOutput: cat.maxOutput || "—",
    inputPrice: cat.inputPrice || "—", outputPrice: cat.outputPrice || "—",
    inputTypes: cat.inputTypes || ["text"], outputTypes: cat.outputTypes || ["text"],
    logo: (size) => { const f = PROVIDER_LOGOS[provider]; return f ? f(size) : DefaultLogo(size) },
  }
}

export function getProviderLogo(provider: string, size?: number): ReactNode {
  return (PROVIDER_LOGOS[provider.toLowerCase()] || DefaultLogo)(size)
}

function guessProvider(m: string): string {
  const n = m.toLowerCase()
  if (n.includes("gpt")||n.includes("dall-e")||n.includes("whisper")) return "openai"
  if (n.includes("claude")) return "anthropic"
  if (n.includes("gemini")||n.includes("palm")||n.includes("gemma")) return "google"
  if (n.includes("deepseek")) return "deepseek"
  if (n.includes("llama")) return "meta"
  if (n.includes("mistral")||n.includes("mixtral")) return "mistral"
  if (n.includes("qwen")||n.includes("tongyi")) return "qwen"
  if (n.includes("glm")||n.includes("chatglm")) return "zhipu"
  if (n.includes("ernie")||n.includes("wenxin")) return "baidu"
  if (n.includes("grok")) return "xai"
  return "custom"
}
