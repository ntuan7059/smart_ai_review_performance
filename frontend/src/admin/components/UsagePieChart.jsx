import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import ChartTooltip from "./ChartTooltip.jsx";

const SLOT_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];
const MAX_SLICES = 6;

/** Folds long tails into "Other" — a 9th generated hue would be indistinguishable under CVD. */
function foldToTop(byUser) {
  if (byUser.length <= MAX_SLICES) return byUser;
  const top = byUser.slice(0, MAX_SLICES - 1);
  const rest = byUser.slice(MAX_SLICES - 1);
  const otherCount = rest.reduce((sum, u) => sum + u.count, 0);
  return [...top, { email: `Other (${rest.length})`, count: otherCount, isOther: true }];
}

export default function UsagePieChart({ byUser }) {
  if (!byUser || !byUser.length) {
    return <p className="muted small">No usage events recorded yet.</p>;
  }

  const slices = foldToTop(byUser);

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="count"
            nameKey="email"
            innerRadius={50}
            outerRadius={85}
            paddingAngle={slices.length > 1 ? 2 : 0}
            strokeWidth={2}
            stroke="var(--panel)"
          >
            {slices.map((s, i) => (
              <Cell key={s.email} fill={s.isOther ? "var(--series-other)" : SLOT_COLORS[i % SLOT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        {slices.map((s, i) => (
          <span className="chart-legend-item" key={s.email}>
            <span
              className="chart-legend-swatch"
              style={{ background: s.isOther ? "var(--series-other)" : SLOT_COLORS[i % SLOT_COLORS.length] }}
            />
            {s.email} ({s.count})
          </span>
        ))}
      </div>
    </div>
  );
}
