"use client"

import { ExternalLink } from "lucide-react"

// Most profile cards in the app are wrapped in a Next <Link> that navigates
// to the in-app deep analysis. Putting an <a> inside an <a> is invalid HTML
// and Next will warn, so this component renders a <button> + window.open
// instead, with stopPropagation/preventDefault so the click doesn't bubble
// to the parent Link.
export function InstagramLink({
  username,
  size = "sm",
  className = "",
}: {
  username: string
  size?: "xs" | "sm" | "md"
  className?: string
}) {
  const clean = username.replace(/^@/, "")
  const iconSize = size === "xs" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
  const padding = size === "xs" ? "p-1" : "p-1.5"
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        window.open(`https://www.instagram.com/${encodeURIComponent(clean)}/`, "_blank", "noopener,noreferrer")
      }}
      title={`Open @${clean} on Instagram`}
      aria-label={`Open @${clean} on Instagram`}
      className={`inline-flex items-center justify-center rounded-md ${padding} text-slate-400 hover:text-purple-700 hover:bg-purple-50 transition-colors ${className}`}
    >
      <ExternalLink className={iconSize} />
    </button>
  )
}
