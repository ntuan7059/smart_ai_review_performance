import React from "react";

export default function TopVulnerabilities({ items }) {
  if (!items || !items.length) {
    return <p className="muted small">No security-bot findings detected in synced PR data.</p>;
  }

  const max = Math.max(...items.map((i) => i.findingCount));

  return (
    <div className="vuln-list">
      {items.map((item) => (
        <div className="vuln-row" key={`${item.repo}#${item.prId}`}>
          <a href={item.link} target="_blank" rel="noreferrer" title={item.title}>
            {item.repo} #{item.prId} — {item.title}
          </a>
          <span className="muted small">
            {item.findingCount} finding{item.findingCount === 1 ? "" : "s"} · {item.author}
          </span>
          <div className="vuln-bar-track">
            <div className="vuln-bar-fill" style={{ width: `${(item.findingCount / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
