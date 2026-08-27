import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import PRDetailRow from "../components/PRDetailRow.jsx";
import { defaultFrom, defaultTo } from "../lib/dates.js";

function formatLocal(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function PRExplorerPage() {
  const toast = useToast();
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [author, setAuthor] = useState("");
  const [state, setState] = useState("");
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    api
      .listRepos()
      .then((r) => {
        setRepos(r);
        if (r.length && !repo) setRepo(r[0].slug);
      })
      .catch((err) => {
        if (err.code === "NOT_CONFIGURED") setNotConfigured(true);
        else toast.error(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!repo) return toast.error("Choose a repository first.");
    setLoading(true);
    try {
      const result = await api.listPRs({ repo, from, to, author, state });
      setPrs(result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(pr) {
    if (expanded === pr.id) {
      setExpanded(null);
      return;
    }
    setExpanded(pr.id);
    if (!details[pr.id]) {
      setDetailLoading(pr.id);
      try {
        const d = await api.getPRDetails(repo, pr.id);
        setDetails((prev) => ({ ...prev, [pr.id]: d }));
      } catch (err) {
        setDetails((prev) => ({ ...prev, [pr.id]: { __error: err.message } }));
      } finally {
        setDetailLoading(null);
      }
    }
  }

  return (
    <div className="page">
      <h2>Explore Pull Requests</h2>

      {notConfigured && (
        <div className="banner banner-info">
          Bitbucket is not configured yet. Fill in Settings to browse pull requests.
        </div>
      )}

      <form className="filter-bar" onSubmit={handleSearch}>
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
        <label>
          State
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="MERGED">Merged</option>
            <option value="DECLINED">Declined</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Loading…" : "Search"}
        </button>
        <button type="button" onClick={() => { setFrom(""); setTo(""); }}>
          Clear dates (search all time)
        </button>
      </form>
      <p className="muted small" style={{ marginTop: -10 }}>
        Defaults to the last 7 days — widen or clear the range to see older PRs.
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th></th>
            <th>ID</th>
            <th>Title</th>
            <th>Author</th>
            <th>State</th>
            <th>Created</th>
            <th>Updated</th>
            <th>Source → Destination</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((pr) => (
            <React.Fragment key={pr.id}>
              <tr className="clickable" onClick={() => toggleExpand(pr)}>
                <td>{expanded === pr.id ? "▼" : "▶"}</td>
                <td>#{pr.id}</td>
                <td>{pr.title}</td>
                <td>{pr.author}</td>
                <td>
                  <StatusBadge value={pr.state} />
                </td>
                <td>{formatLocal(pr.createdAt)}</td>
                <td>{formatLocal(pr.updatedAt)}</td>
                <td>
                  <code>{pr.sourceBranch}</code> → <code>{pr.destinationBranch}</code>
                </td>
              </tr>
              {expanded === pr.id && (
                <tr>
                  <td colSpan={8}>
                    <PRDetailRow
                      details={details[pr.id]?.__error ? null : details[pr.id]}
                      error={details[pr.id]?.__error}
                      loading={detailLoading === pr.id}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {!loading && prs.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">
                No pull requests loaded yet — pick a repo and click Search.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
