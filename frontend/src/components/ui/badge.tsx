import { cn } from "@/lib/utils"

const variants = {
  default: "bg-surface-100 text-surface-700 border-surface-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  danger:  "bg-red-50 text-red-600 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info:    "bg-blue-50 text-blue-700 border-blue-200",
  brand:   "bg-surface-950 text-white border-surface-950",
} as const

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", variants[variant], className)} {...props}>
      {children}
    </span>
  )
}
