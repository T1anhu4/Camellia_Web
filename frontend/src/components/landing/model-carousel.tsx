"use client"

import { useEffect, useState, useRef } from "react"
import { getModelMeta } from "@/lib/models"

export function ModelCarousel() {
  const [models, setModels] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/public/models")
      .then(r => r.json())
      .then(d => setModels(d.models || []))
      .catch(() => {})
  }, [])

  // Continuous scroll animation effect
  useEffect(() => {
    if (models.length === 0) return
    const el = scrollRef.current
    if (!el) return
    let animationId: number
    let offset = 0
    const speed = 0.5 // pixels per frame
    const animate = () => {
      offset += speed
      if (offset >= el.scrollWidth / 2) offset = 0
      el.style.transform = `translateX(-${offset}px)`
      animationId = requestAnimationFrame(animate)
    }
    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [models])

  if (models.length === 0) return null

  // Duplicate items for seamless loop
  const items = [...models, ...models, ...models, ...models, ...models]

  return (
    <div className="relative w-full overflow-hidden py-10">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-[60px] md:w-[120px] bg-gradient-to-r from-surface-50 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-[60px] md:w-[120px] bg-gradient-to-r from-transparent to-surface-50 z-10 pointer-events-none" />

      <div ref={scrollRef} className="flex gap-8 md:gap-14" style={{ width: "max-content", willChange: "transform" }}>
        {items.map((model, i) => {
          const meta = getModelMeta(model)
          return (
            <div key={`${model}-${i}`} className="flex flex-col items-center gap-3 shrink-0 w-[100px] md:w-[120px] group select-none">
              <div className="w-[56px] h-[56px] md:w-[64px] md:h-[64px] rounded-2xl bg-white border border-surface-200 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:border-surface-300 transition-all duration-200">
                {meta.logo(32)}
              </div>
              <div className="text-center w-full">
                <div className="text-xs md:text-sm font-semibold text-surface-800 truncate">{model}</div>
                <div className="text-[10px] md:text-xs text-surface-500 mt-0.5">{meta.providerLabel}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
