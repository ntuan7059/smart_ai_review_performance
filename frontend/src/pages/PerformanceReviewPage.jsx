import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import Markdown from "../components/Markdown.jsx";

const METRIC_LABELS = [
  ["totalPRs", "Total PRs"],
  ["mergedPRs", "Merged"],
  ["approvalRate", "Approval rate"],
  ["linkedTickets", "Linked tickets"],
  ["storyPoints", "Story points"],
  ["avgReviewCommentsPerPr", "Avg comments / PR"],
  ["linesAdded", "Lines added"],
  ["linesRemoved", "Lines removed"],
  ["reopenedTicketCount", "Reopen events"],
  ["avgDaysToReworkPr", "Avg days to fix (rework)"],
];

function formatMetric(key, value) {
  if (value === null || value === undefined) return "—";
  if (key === "approvalRate") return `${Math.round(value * 100)}%`;
  if (key === "avgDaysToReworkPr") return `${value}d`;
  return value;
}

export default function PerformanceReviewPage() {
  const toast = useToast();
  const [authors, setAuthors] = useState([]);
  const [author, setAuthor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .listAiReviewAuthors()
      .then(setAuthors)
      .catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRun(e) {
    e.preventDefault();
    if (!author) return toast.error("Choose a person first.");
    setLoading(true);
    setResult(null);
    try {
      const res = await api.runAiReview({ author, from, to });
      setResult(res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result.review], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const rangeLabel = `${result.from || "all-time"}_to_${result.to || "all-time"}`;
    a.href = url;
    a.download = `performance-review_${author}_${rangeLabel}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <h2>AI Review</h2>
      <p className="muted">
        Sends the AI agent configured in Settings an evidence packet — per-PR diffstats, commit messages, review
        comments, and linked ticket descriptions/comments — and asks it to write a structured report (delivery,
        code quality, rework/bug turnaround, recommendations) that cites specific PRs and tickets rather than
        vague generalities. Downloadable as a Markdown document once generated.
      </p>

      <form className="filter-bar" onSubmit={handleRun}>
        <label>
          Person
          <select value={author} onChange={(e) => setAuthor(e.target.value)}>
            <option value="">Select…</option>
            {authors.map((a) => (
              <option key={a.authorUsername || a.author} value={a.authorUsername || a.author}>
                {a.author || a.authorUsername}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Reviewing…" : "Run review"}
        </button>
      </form>

      {loading && <p className="muted">Asking the AI agent — this can take a little while…</p>}

      {result && (
        <>
          <div className="metric-grid">
            {METRIC_LABELS.map(([key, label]) => (
              <div className="metric-card" key={key}>
                <div className="metric-value">{formatMetric(key, result.metrics[key])}</div>
                <div className="metric-label">{label}</div>
              </div>
            ))}
          </div>

          <div className="detail-panel">
            <div className="muted small" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                Provider: {result.provider} · Range: {result.from || "all time"} → {result.to || "all time"}
              </span>
              <button type="button" onClick={handleDownload}>
                Download report (.md)
              </button>
            </div>
            <Markdown text={result.review} />
          </div>
        </>
      )}

      {!loading && !result && (
        <p className="muted">Pick a person and click Run review. Requires a Sync to have run first.</p>
      )}
    </div>
  );
}
