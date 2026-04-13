"use client"

import {
  LineChart,
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
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
}

export function LikesChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="date"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="likes"
          stroke="#7c3aed"
          strokeWidth={2}
          dot={false}
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
      </LineChart>
    </ResponsiveContainer>
  )
}
