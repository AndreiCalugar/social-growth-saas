import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

// The Social Growth logo mark — same trend arrow on purple as the app icon.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-sm",
        className
      )}
    >
      <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
    </span>
  )
}
