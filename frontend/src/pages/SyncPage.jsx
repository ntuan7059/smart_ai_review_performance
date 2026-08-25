import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { defaultFrom, defaultTo } from "../lib/dates.js";

function formatLocal(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const SORT_OPTIONS = [
  { value: "createdAt", label: "Created date" },
  { value: "author", label: "Author" },
  { value: "ticketStatus", label: "Ticket status" },
  { value: "jiraKey", label: "Ticket" },
];

export default function SyncPage() {
  const toast = useToast();
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [author, setAuthor] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterLinkStatus, setFilterLinkStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

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

  async function loadRecords(forRepo) {
    setLoadingRecords(true);
    try {
      const r = await api.getRecords(forRepo);
      setRecords(r);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingRecords(false);
    }
  }

  useEffect(() => {
    if (repo) loadRecords(repo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  async function handleSync(e) {
    e.preventDefault();
    if (!repo) return toast.error("Choose a repository first.");
    setSyncing(true);
    try {
      const result = await api.sync({ repo, from, to, author });
      toast.success(`Synced ${result.synced} PR(s), ${result.failed} failed.`);
      if (result.failed > 0) {
        toast.error(`${result.failed} PR(s) failed to sync — check backend logs.`);
      }
      await loadRecords(repo);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const visibleRecords = useMemo(() => {
    let rows = [...records];
    if (filterAuthor) {
      rows = rows.filter((r) => (r.author || "").toLowerCase().includes(filterAuthor.toLowerCase()));
    }
    if (filterLinkStatus) {
      rows = rows.filter((r) => r.linkStatus === filterLinkStatus);
    }
    rows.sort((a, b) => {
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [records, filterAuthor, filterLinkStatus, sortBy, sortDir]);

  return (
    <div className="page">
      <h2>Sync &amp; Records</h2>

      <form className="filter-bar" onSubmit={handleSync}>
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
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Author (username)
          <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="jdoe" />
        </label>
        <button type="submit" disabled={syncing}>
          {syncing ? "Syncing…" : "Sync"}
        </button>
        <button type="button" onClick={() => { setFrom(""); setTo(""); }}>
          Clear dates (sync all time)
        </button>
      </form>
      <p className="muted small" style={{ marginTop: -10 }}>
        Defaults to the last 7 days — widen or clear the range to pull older PRs.
      </p>

      <div className="filter-bar">
        <label>
          Filter by author
          <input type="text" value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)} />
        </label>
        <label>
          Filter by link status
          <select value={filterLinkStatus} onChange={(e) => setFilterLinkStatus(e.target.value)}>
            <option value="">All</option>
            <option value="linked">Linked</option>
            <option value="unlinked">Unlinked</option>
            <option value="ambiguous">Ambiguous</option>
          </select>
        </label>
        <label>
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {sortDir === "asc" ? "↑ Ascending" : "↓ Descending"}
        </button>
      </div>

      {loadingRecords ? (
        <p className="muted">Loading persisted records…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>PR</th>
              <th>Title</th>
              <th>Author</th>
              <th>State</th>
              <th>Created</th>
              <th>Merged</th>
              <th>Ticket</th>
              <th>Ticket status</th>
              <th>Story pts</th>
              <th>Link status</th>
              <th>Reopened</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((r) => (
              <tr key={`${r.repo}-${r.prId}`} className={r.linkStatus !== "linked" ? "row-flagged" : ""}>
                <td>#{r.prId}</td>
                <td>{r.title}</td>
                <td>{r.author}</td>
                <td>
                  <StatusBadge value={r.state} />
                </td>
                <td>{formatLocal(r.createdAt)}</td>
                <td>{formatLocal(r.mergedAt)}</td>
                <td>
                  {r.jiraKey ? (
                    <code>{r.jiraKey}</code>
                  ) : (
                    <span className="muted">none</span>
                  )}
                  {r.multipleKeysDetected && (
                    <span className="badge badge-orange" title={r.jiraKeyCandidates?.join(", ")}>
                      multiple
                    </span>
                  )}
                </td>
                <td>{r.ticketStatus ? <StatusBadge value={r.ticketStatus} /> : "—"}</td>
                <td>{r.storyPoints ?? "—"}</td>
                <td>
                  <StatusBadge value={r.linkStatus} />
                  {r.ticketError && <div className="muted small">{r.ticketError.message}</div>}
                </td>
                <td>
                  {r.reopened ? (
                    <span className="badge badge-orange" title={r.reopenDates?.map(formatLocal).join(", ")}>
                      {r.reopenCount}×
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {visibleRecords.length === 0 && (
              <tr>
                <td colSpan={11} className="muted">
                  No records yet — run a Sync above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
