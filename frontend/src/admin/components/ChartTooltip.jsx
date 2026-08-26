import React from "react";

/** Dark-theme tooltip shared by every recharts chart in the admin dashboard. */
export default function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 12,
      }}
    >
      {label !== undefined && (
        <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      )}
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 2,
              background: entry.color,
              display: "inline-block",
              borderRadius: 1,
            }}
          />
          <span style={{ color: "var(--text)", fontWeight: 600 }}>
            {formatter ? formatter(entry.value, entry) : entry.value}
          </span>
          <span style={{ color: "var(--muted)" }}>{entry.name}</span>
        </div>
      ))}
    </div>
  );
}
