"use client"

import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface DataPoint {
  date: string
  likes: number
  views: number
}

interface Props {
  data: DataPoint[]
}

const tickStyle = { fontSize: 11, fill: "#94a3b8" }
const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 14px -4px rgb(0 0 0 / 0.08)",
}

export function LikesChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={false} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="likes"
          stroke="#7c3aed"
          strokeWidth={2.25}
          fill="url(#likesGradient)"
          activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
          name="Likes"
        />
        <Line
          type="monotone"
          dataKey="views"
          stroke="#cbd5e1"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 3"
          name="Views÷10"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
