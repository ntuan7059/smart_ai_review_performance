import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Markdown from "../components/Markdown.jsx";

const POLL_INTERVAL_MS = 60 * 1000;

function formatLocal(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function PrWatchPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [reviewingKey, setReviewingKey] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const seenKeys = useRef(null); // null until first load, so we never notify for PRs that already existed

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function refresh() {
    try {
      const list = await api.listPrWatch();
      if (seenKeys.current) {
        const fresh = list.filter((i) => !seenKeys.current.has(`${i.repo}#${i.prId}`));
        for (const pr of fresh) {
          toast.info(`New PR: #${pr.prId} ${pr.title} (${pr.author})`);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("New pull request", {
              body: `#${pr.prId} ${pr.title} — ${pr.author} (${pr.repo})`,
            });
          }
        }
      }
      seenKeys.current = new Set(list.map((i) => `${i.repo}#${i.prId}`));
      setItems(list);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManualRefresh() {
    try {
      const { added } = await api.refreshPrWatch();
      toast.success(added > 0 ? `Found ${added} new PR(s).` : "No new PRs.");
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleReview(item) {
    const key = `${item.repo}#${item.prId}`;
    setReviewingKey(key);
    try {
      const updated = await api.reviewWatchedPr(item.repo, item.prId);
      setItems((prev) => prev.map((i) => (`${i.repo}#${i.prId}` === key ? updated : i)));
      setOpenKey(key);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReviewingKey(null);
    }
  }

  const openItem = items.find((i) => `${i.repo}#${i.prId}` === openKey);

  return (
    <div className="page">
      <h2>PR Watch</h2>
      <p className="muted">
        Polls every 30 minutes for pull requests created today across all repos in the configured workspace
        and pops a desktop notification when a new one shows up. Click <strong>Review</strong> to have the AI
        agent critique that PR's code change, review quality, and ticket alignment as a standalone document.
        The list resets at the start of each day (UTC).
      </p>

      <div className="filter-bar">
        <button type="button" onClick={handleManualRefresh}>
          Check for new PRs now
        </button>
      </div>

      {!loaded ? (
        <p className="muted">Loading today's PR watch list…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>PR</th>
              <th>Repo</th>
              <th>Title</th>
              <th>Author</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const key = `${item.repo}#${item.prId}`;
              return (
                <tr key={key}>
                  <td>#{item.prId}</td>
                  <td>{item.repo}</td>
                  <td>{item.title}</td>
                  <td>{item.author}</td>
                  <td>{formatLocal(item.createdAt)}</td>
                  <td>
                    <StatusBadge
                      value={item.status === "reviewed" ? "Reviewed" : "Not reviewed"}
                      tone={item.status === "reviewed" ? "badge-green" : "badge-orange"}
                    />
                  </td>
                  <td>
                    {item.status === "reviewed" ? (
                      <button type="button" className="link-button" onClick={() => setOpenKey(key)}>
                        View report
                      </button>
                    ) : (
                      <button type="button" disabled={reviewingKey === key} onClick={() => handleReview(item)}>
                        {reviewingKey === key ? "Reviewing…" : "Review"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No PRs created today yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {openItem && (
        <div className="detail-panel">
          <div
            className="muted small"
            style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>
              PR #{openItem.prId} ({openItem.repo}) · Reviewed {formatLocal(openItem.reviewedAt)}
            </span>
            <button type="button" onClick={() => setOpenKey(null)}>
              Close
            </button>
          </div>
          <Markdown text={openItem.reviewDocument} />
        </div>
      )}
    </div>
  );
}
