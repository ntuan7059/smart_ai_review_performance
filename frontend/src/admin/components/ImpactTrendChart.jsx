import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import ChartTooltip from "./ChartTooltip.jsx";

const TREND_LABEL = {
  improving: { text: "Improving", className: "trend-badge-good" },
  worsening: { text: "Worsening", className: "trend-badge-critical" },
  flat: { text: "Flat", className: "trend-badge-flat" },
};

export default function ImpactTrendChart({ points, trend }) {
  if (!points || !points.length) {
    return <p className="muted small">Not enough synced PR history to compute a trend yet.</p>;
  }

  const badge = TREND_LABEL[trend] || TREND_LABEL.flat;
  const data = points.map((p) => ({ ...p, reopenRatePct: Number((p.reopenRate * 100).toFixed(1)) }));

  return (
    <div>
      <span className={`trend-badge ${badge.className}`}>{badge.text}</span>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis
            allowDecimals={false}
            unit="%"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} cursor={{ stroke: "var(--border)" }} />
          <Line
            type="monotone"
            dataKey="reopenRatePct"
            name="PR reopen rate"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: "var(--panel)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--panel)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
