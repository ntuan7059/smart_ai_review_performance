import { getToken, clearSession } from "./adminAuth.js";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }

  if (res.status === 401) clearSession();

  if (!res.ok) {
    const message = body?.error?.message || `Request failed: ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return body;
}

export const adminApi = {
  login: (email, password) => request("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  getUsage: ({ granularity, from, to }) => {
    const params = new URLSearchParams({ granularity });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/admin/usage?${params.toString()}`);
  },
  getSummary: () => request("/admin/summary"),
  getTopVulnerabilities: (limit = 10) => request(`/admin/vulnerabilities/top?limit=${limit}`),
  getImpact: () => request("/admin/impact"),

  listAuthors: () => request("/admin/authors"),
  setAuthorEmail: (key, email) =>
    request(`/admin/authors/${encodeURIComponent(key)}`, { method: "POST", body: JSON.stringify({ email }) }),
};
