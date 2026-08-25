import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

function formatLocal(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function ByTicketPage() {
  const toast = useToast();
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api
      .listRepos()
      .then((r) => {
        setRepos(r);
        if (r.length && !repo) setRepo(r[0].slug);
      })
      .catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!repo) return;
    setLoading(true);
    api
      .getByTicket(repo)
      .then(setGroups)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  return (
    <div className="page">
      <h2>By Ticket</h2>
      <p className="muted">
        Rolls up all synced PRs by the Jira ticket they reference. Tickets touched by more than one PR are
        grouped here instead of being overwritten.
      </p>

      <div className="filter-bar">
        <label>
          Repo
          <select value={repo} onChange={(e) => setRepo(e.target.value)}>
            <option value="">Select…</option>
            {repos.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Ticket</th>
              <th>Status</th>
              <th>Story pts</th>
              <th>PR count</th>
              <th>Reopened</th>
              <th>Link status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const key = g.jiraKey || `unlinked-${g.prs[0]?.prId}`;
              return (
                <React.Fragment key={key}>
                  <tr className="clickable" onClick={() => setExpanded(expanded === key ? null : key)}>
                    <td>{expanded === key ? "▼" : "▶"}</td>
                    <td>{g.jiraKey ? <code>{g.jiraKey}</code> : <span className="muted">(unlinked)</span>}</td>
                    <td>{g.ticketStatus ? <StatusBadge value={g.ticketStatus} /> : "—"}</td>
                    <td>{g.storyPoints ?? "—"}</td>
                    <td>{g.prIds.length}</td>
                    <td>
                      {g.reopened ? (
                        <span className="badge badge-orange" title={g.reopenDates?.map(formatLocal).join(", ")}>
                          {g.reopenCount}×
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <StatusBadge value={g.linkStatus} />
                    </td>
                  </tr>
                  {expanded === key && (
                    <tr>
                      <td colSpan={7}>
                        <div className="detail-panel">
                          <ul className="compact-list">
                            {g.prs.map((pr) => (
                              <li key={`${pr.repo}-${pr.prId}`}>
                                #{pr.prId} <strong>{pr.title}</strong> — {pr.author} —{" "}
                                <StatusBadge value={pr.state} /> — created {formatLocal(pr.createdAt)}
                                {pr.mergedAt && <> — merged {formatLocal(pr.mergedAt)}</>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No records yet — run a Sync first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
