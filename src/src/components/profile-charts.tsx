"use client"

import { useState, useMemo } from "react"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface Post {
  posted_at: string | null
  likes: number | null
  views: number | null
  comments: number | null
  engagement_rate: number | null
  content_type: string | null
}

interface Props {
  posts: Post[]
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const CONTENT_COLORS: Record<string, string> = {
  reel: "#7c3aed",
  carousel: "#059669",
  image: "#d97706",
  other: "#94a3b8",
}

const tickStyle = { fontSize: 11, fill: "#94a3b8" }
const gridStroke = "#f1f5f9"
const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
}

export function ProfileCharts({ posts }: Props) {
  const [days, setDays] = useState<30 | 60 | 90>(30)

  const cutoff = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d
  }, [days])

  const timelineData = useMemo(() => {
    return posts
      .filter((p) => p.posted_at && new Date(p.posted_at) >= cutoff)
      .map((p) => ({
        date: new Date(p.posted_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        likes: p.likes ?? 0,
        views: Math.round((p.views ?? 0) / 10),
      }))
  }, [posts, cutoff])

  const dowData = useMemo(() => {
    const buckets = DAYS.map((label) => ({ label, totalLikes: 0, count: 0 }))
    for (const p of posts) {
      if (!p.posted_at) continue
      const dow = new Date(p.posted_at).getDay()
      buckets[dow].totalLikes += p.likes ?? 0
      buckets[dow].count += 1
    }
    return buckets.map((b) => ({ day: b.label, avgLikes: b.count > 0 ? Math.round(b.totalLikes / b.count) : 0 }))
  }, [posts])

  const hourData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, totalLikes: 0, count: 0 }))
    for (const p of posts) {
      if (!p.posted_at) continue
      const h = new Date(p.posted_at).getHours()
      buckets[h].totalLikes += p.likes ?? 0
      buckets[h].count += 1
    }
    return buckets
      .filter((b) => b.count > 0)
      .map((b) => ({ hour: `${b.hour}:00`, avgLikes: Math.round(b.totalLikes / b.count) }))
  }, [posts])

  const contentData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of posts) {
      const type = p.content_type ?? "other"
      counts[type] = (counts[type] ?? 0) + 1
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [posts])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Likes over time */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">Likes over time</CardTitle>
            <CardDescription className="text-xs">Purple = likes · Gray dashed = views ÷ 10</CardDescription>
          </div>
          <div className="flex gap-1">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  days === d
                    ? "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timelineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} />
                <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#e2e8f0" }} />
                <Line type="monotone" dataKey="likes" stroke="#7c3aed" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }} name="Likes" />
                <Line type="monotone" dataKey="views" stroke="#cbd5e1" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Views÷10" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
              No posts in this range
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day of week */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900">Avg likes by day</CardTitle>
          <CardDescription className="text-xs">Best days to post</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dowData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="day" tick={tickStyle} tickLine={false} axisLine={false} />
              <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avgLikes" fill="#7c3aed" radius={[6, 6, 0, 0]} name="Avg Likes" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hour of day */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900">Avg likes by hour</CardTitle>
          <CardDescription className="text-xs">Best times to post (UTC)</CardDescription>
        </CardHeader>
        <CardContent>
          {hourData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="hour" tick={tickStyle} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="avgLikes" fill="#059669" radius={[6, 6, 0, 0]} name="Avg Likes" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
              No data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content type donut */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900">Content type breakdown</CardTitle>
          <CardDescription className="text-xs">Post count by format</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-10">
          {contentData.length > 0 ? (
            <>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={contentData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {contentData.map((entry) => (
                      <Cell key={entry.name} fill={CONTENT_COLORS[entry.name] ?? CONTENT_COLORS.other} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2.5">
                {contentData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2.5 text-sm">
                    <span
                      className="inline-block h-3 w-3 rounded-sm shrink-0"
                      style={{ backgroundColor: CONTENT_COLORS[entry.name] ?? CONTENT_COLORS.other }}
                    />
                    <span className="capitalize font-medium text-slate-700">{entry.name}</span>
                    <span className="text-slate-400">{entry.value} posts</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[160px] items-center justify-center text-sm text-slate-400 w-full">
              No data yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
