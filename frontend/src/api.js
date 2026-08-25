// In dev, Vite proxies "/api" to the backend (see vite.config.js). In production the
// frontend and backend are separate deployments, so point this at the backend's URL.
const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. 204)
  }

  if (!res.ok) {
    const message = body?.error?.message || `Request failed: ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return body;
}

export const api = {
  getConfig: () => request("/config"),
  saveConfig: (data) => request("/config", { method: "POST", body: JSON.stringify(data) }),
  testConnections: () => request("/config/test", { method: "POST" }),
  listJiraProjects: () => request("/config/jira-projects"),
  verifyBitbucketWorkspace: (slug) => request(`/config/bitbucket-workspaces/${encodeURIComponent(slug)}/verify`),

  listRepos: () => request("/bitbucket/repos"),
  listPRs: ({ repo, from, to, author, state }) => {
    const params = new URLSearchParams({ repo });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (author) params.set("author", author);
    if (state) params.set("state", state);
    return request(`/bitbucket/prs?${params.toString()}`);
  },
  getPRDetails: (repo, id) => request(`/bitbucket/prs/${id}/details?repo=${encodeURIComponent(repo)}`),

  getTicket: (key) => request(`/jira/tickets/${encodeURIComponent(key)}`),

  sync: ({ repo, from, to, author, state }) => {
    const params = new URLSearchParams({ repo });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (author) params.set("author", author);
    if (state) params.set("state", state);
    return request(`/sync?${params.toString()}`, { method: "POST" });
  },
  getRecords: (repo) => request(`/records${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`),
  getByTicket: (repo) => request(`/records/by-ticket${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`),

  listAiReviewAuthors: () => request("/ai-review/authors"),
  runAiReview: ({ author, from, to }) =>
    request("/ai-review", { method: "POST", body: JSON.stringify({ author, from, to }) }),

  listPrWatch: () => request("/pr-watch"),
  refreshPrWatch: () => request("/pr-watch/refresh", { method: "POST" }),
  reviewWatchedPr: (repo, prId) =>
    request(`/pr-watch/${encodeURIComponent(repo)}/${prId}/review`, { method: "POST" }),
};
