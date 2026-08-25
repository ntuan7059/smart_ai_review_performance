import React from "react";

function formatLocal(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function PRDetailRow({ details, loading, error }) {
  if (loading) return <div className="detail-panel muted">Loading details…</div>;
  if (error) return <div className="detail-panel error-text">Failed to load details: {error}</div>;
  if (!details) return null;

  return (
    <div className="detail-panel">
      <div className="detail-grid">
        <div>
          <strong>Approved</strong>
          <div>{formatLocal(details.approvedAt)}</div>
          {details.approvedBy && <div className="muted">by {details.approvedBy}</div>}
        </div>
        <div>
          <strong>Merged</strong>
          <div>{formatLocal(details.mergedAt)}</div>
          {details.mergedBy && <div className="muted">by {details.mergedBy}</div>}
        </div>
      </div>

      <div className="detail-section">
        <strong>Diffstat ({details.diffstat?.length ?? 0} files)</strong>
        <ul className="compact-list">
          {(details.diffstat || []).slice(0, 20).map((d, i) => (
            <li key={i}>
              <code>{d.path}</code> <span className="muted">({d.status})</span>{" "}
              <span className="diff-add">+{d.linesAdded}</span> <span className="diff-remove">-{d.linesRemoved}</span>
            </li>
          ))}
          {details.diffstat?.length > 20 && <li className="muted">…and {details.diffstat.length - 20} more</li>}
        </ul>
      </div>

      <div className="detail-section">
        <strong>Commits ({details.commits?.length ?? 0})</strong>
        <ul className="compact-list">
          {(details.commits || []).slice(0, 10).map((c) => (
            <li key={c.hash}>
              <code>{c.hash.slice(0, 7)}</code> {c.message?.split("\n")[0]} <span className="muted">— {c.author}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="detail-section">
        <strong>Comments ({details.comments?.length ?? 0})</strong>
        <ul className="compact-list">
          {(details.comments || []).slice(0, 10).map((c) => (
            <li key={c.id}>
              <strong>{c.author}</strong>: {c.content} <span className="muted">({formatLocal(c.createdAt)})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
