import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import ChartTooltip from "./ChartTooltip.jsx";

const SERIES = [
  { key: "pr_review", name: "PR Reviews", color: "var(--series-1)" },
  { key: "performance_review", name: "Performance Reviews", color: "var(--series-2)" },
];

export default function UsageLineChart({ data }) {
  if (!data || !data.length) {
    return <p className="muted small">No usage events recorded yet for this range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
        />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: "var(--panel)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--panel)" }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
