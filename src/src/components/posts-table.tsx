"use client"

import { useState, useMemo } from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

interface Post {
  id: string
  posted_at: string | null
  caption: string | null
  likes: number | null
  comments: number | null
  views: number | null
  engagement_rate: number | null
}

type SortKey = "posted_at" | "likes" | "comments" | "views" | "engagement_rate"

interface Props {
  posts: Post[]
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function SortIcon({ col, active, dir }: { col: string; active: string; dir: "asc" | "desc" }) {
  if (col !== active) return <ChevronsUpDown className="h-3 w-3 opacity-40" />
  return dir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
}

export function PostsTable({ posts }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("likes")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sorted = useMemo(() => {
    return [...posts].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity
      const bv = b[sortKey] ?? -Infinity
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv)
      }
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })
  }, [posts, sortKey, sortDir])

  // Top 10 / bottom 10 by likes (based on original post list)
  const likesSorted = useMemo(() => [...posts].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)), [posts])
  const topIds = new Set(likesSorted.slice(0, 10).map((p) => p.id))
  const bottomIds = new Set(likesSorted.slice(-10).map((p) => p.id))

  const headers: { key: SortKey; label: string }[] = [
    { key: "posted_at", label: "Date" },
    { key: "likes", label: "Likes" },
    { key: "comments", label: "Comments" },
    { key: "views", label: "Views" },
    { key: "engagement_rate", label: "Eng. Rate" },
  ]

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Caption</th>
            {headers.map(({ key, label }) => (
              <th key={key} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => handleSort(key)}
                >
                  {label}
                  <SortIcon col={key} active={sortKey} dir={sortDir} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((post) => {
            const isExpanded = expandedId === post.id
            const isTop = topIds.has(post.id)
            const isBottom = bottomIds.has(post.id) && !isTop
            const rowClass = isTop
              ? "bg-green-50 hover:bg-green-100"
              : isBottom
              ? "bg-red-50 hover:bg-red-100"
              : "hover:bg-muted/30"

            return (
              <tr
                key={post.id}
                className={`border-b cursor-pointer transition-colors ${rowClass}`}
                onClick={() => setExpandedId(isExpanded ? null : post.id)}
              >
                <td className="px-3 py-2 max-w-[280px]">
                  <p className={`text-xs text-muted-foreground ${isExpanded ? "" : "truncate"}`}>
                    {post.caption ? (isExpanded ? post.caption : post.caption.slice(0, 80)) : "—"}
                  </p>
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {post.posted_at
                    ? new Date(post.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs font-medium">{fmt(post.likes)}</td>
                <td className="px-3 py-2 text-xs">{fmt(post.comments)}</td>
                <td className="px-3 py-2 text-xs">{fmt(post.views)}</td>
                <td className="px-3 py-2 text-xs">
                  {post.engagement_rate != null ? `${post.engagement_rate.toFixed(2)}%` : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
