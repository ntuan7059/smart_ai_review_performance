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
    error.code = body?.error?.code;
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

  sync: ({ repo, from, to, author, state }) => {
    const params = new URLSearchParams({ repo });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (author) params.set("author", author);
    if (state) params.set("state", state);
    return request(`/sync?${params.toString()}`, { method: "POST" });
  },
  getRecords: (repo) => request(`/records${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`),

  listAiReviewAuthors: () => request("/ai-review/authors"),
  runAiReview: ({ author, authorUsername, from, to, mode }) =>
    request("/ai-review", { method: "POST", body: JSON.stringify({ author, authorUsername, from, to, mode }) }),

  listPrReviews: ({ author, from, to, repo } = {}) => {
    const params = new URLSearchParams();
    if (author) params.set("author", author);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (repo) params.set("repo", repo);
    const qs = params.toString();
    return request(`/pr-reviews${qs ? `?${qs}` : ""}`);
  },
  listPrReviewStatuses: (repo) =>
    request(`/pr-reviews/status${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`),
  getPrReview: (repo, prId) => request(`/pr-reviews/${encodeURIComponent(repo)}/${prId}`),
  reviewPullRequest: (repo, prId) =>
    request(`/pr-reviews/${encodeURIComponent(repo)}/${prId}`, { method: "POST" }),
};
