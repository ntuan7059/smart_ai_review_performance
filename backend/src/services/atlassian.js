import { createAtlassianClient, AtlassianApiError } from "../lib/httpClient.js";
import { readConfig } from "../config/configStore.js";

const BITBUCKET_BASE_URL = "https://api.bitbucket.org/2.0";

export function getJiraClient() {
  const cfg = readConfig();
  if (!cfg.jiraBaseUrl || !cfg.atlassianEmail || !cfg.atlassianApiToken) {
    throw new AtlassianApiError("Jira is not configured. Fill in Settings first.", 400, "NOT_CONFIGURED");
  }
  return createAtlassianClient({
    baseURL: cfg.jiraBaseUrl.replace(/\/+$/, ""),
    email: cfg.atlassianEmail,
    token: cfg.atlassianApiToken,
  });
}

export function getBitbucketClient() {
  const cfg = readConfig();
  if (!cfg.atlassianEmail || !cfg.bitbucketApiToken) {
    throw new AtlassianApiError(
      "Bitbucket is not configured. Click Save settings after filling Atlassian email and Bitbucket API token.",
      400,
      "NOT_CONFIGURED"
    );
  }
  return createAtlassianClient({
    baseURL: BITBUCKET_BASE_URL,
    email: cfg.atlassianEmail,
    token: cfg.bitbucketApiToken,
  });
}

export async function testJiraConnection() {
  const client = getJiraClient();
  const res = await client.get("/rest/api/3/myself");
  return { ok: true, displayName: res.data.displayName, accountId: res.data.accountId };
}

export async function testBitbucketConnection() {
  const client = getBitbucketClient();
  const res = await client.get("/user");
  return { ok: true, displayName: res.data.display_name, username: res.data.username };
}

export async function listJiraProjects() {
  const client = getJiraClient();
  const res = await client.get("/rest/api/3/project/search", {
    params: { maxResults: 100 },
  });
  return (res.data.values || []).map((p) => ({ id: p.id, key: p.key, name: p.name }));
}

/**
 * Bitbucket removed the "list all accessible workspaces" endpoint (CHANGE-2770,
 * GET /workspaces now returns 410 Gone with no direct replacement), so the best we
 * can do is confirm a specific slug the user typed actually exists and is accessible.
 */
export async function verifyBitbucketWorkspace(slug) {
  const client = getBitbucketClient();
  const res = await client.get(`/workspaces/${encodeURIComponent(slug)}`);
  return { slug: res.data.slug, name: res.data.name };
}
