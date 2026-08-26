import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "./adminApi.js";
import { clearSession, getAdminEmail } from "./adminAuth.js";
import UsageLineChart from "./components/UsageLineChart.jsx";
import UsagePieChart from "./components/UsagePieChart.jsx";
import TopVulnerabilities from "./components/TopVulnerabilities.jsx";
import ImpactTrendChart from "./components/ImpactTrendChart.jsx";
import AuthorMappingEditor from "./components/AuthorMappingEditor.jsx";

const GRANULARITIES = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [granularity, setGranularity] = useState("day");
  const [usage, setUsage] = useState(null);
  const [summary, setSummary] = useState(null);
  const [topVulns, setTopVulns] = useState(null);
  const [impact, setImpact] = useState(null);
  const [authors, setAuthors] = useState(null);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [usageRes, summaryRes, vulnRes, impactRes, authorsRes] = await Promise.all([
        adminApi.getUsage({ granularity }),
        adminApi.getSummary(),
        adminApi.getTopVulnerabilities(10),
        adminApi.getImpact(),
        adminApi.listAuthors(),
      ]);
      setUsage(usageRes);
      setSummary(summaryRes);
      setTopVulns(vulnRes);
      setImpact(impactRes);
      setAuthors(authorsRes);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
      if (err.status === 401) navigate("/admin/login", { replace: true });
    }
  }, [granularity, navigate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function handleLogout() {
    clearSession();
    navigate("/admin/login", { replace: true });
  }

  const kpis = summary
    ? [
        { label: "PR reviews", value: summary.byType.find((t) => t.type === "pr_review")?.count || 0 },
        {
          label: "Performance reviews",
          value: summary.byType.find((t) => t.type === "performance_review")?.count || 0,
        },
        { label: "Vulnerability findings (top PRs)", value: (topVulns || []).reduce((s, v) => s + v.findingCount, 0) },
        { label: "Active users", value: summary.byUser.filter((u) => u.email !== "unmapped").length },
      ]
    : [];

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <label>
            Granularity
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              {GRANULARITIES.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <span className="muted small">{getAdminEmail()}</span>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {error && <p className="error-text">{error}</p>}

      <div className="kpi-row">
        {kpis.map((k) => (
          <div className="kpi-tile" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-card chart-card-wide">
          <h3>Usage over time</h3>
          <p className="chart-subtitle">PR reviews and performance reviews triggered, by {granularity}.</p>
          <UsageLineChart data={usage?.series} />
        </div>

        <div className="chart-card">
          <h3>Usage share by user</h3>
          <p className="chart-subtitle">Total reviews attributed to each engineer's email.</p>
          <UsagePieChart byUser={summary?.byUser} />
        </div>

        <div className="chart-card">
          <h3>Impact over time</h3>
          <p className="chart-subtitle">PR reopen rate by month — lower is better.</p>
          <ImpactTrendChart points={impact?.points} trend={impact?.trend} />
        </div>

        <div className="chart-card chart-card-wide">
          <h3>Top PRs by vulnerability findings</h3>
          <p className="chart-subtitle">
            Derived from security-bot (Snyk, etc.) comments on synced PRs — no scanner is integrated directly.
          </p>
          <TopVulnerabilities items={topVulns} />
        </div>
      </div>

      {authors && <AuthorMappingEditor mappings={authors} onChange={loadAll} />}
    </div>
  );
}
