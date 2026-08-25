import { getJiraClient } from "./atlassian.js";
import { adfToPlainText } from "../lib/adf.js";
import { readConfig } from "../config/configStore.js";
import { AtlassianApiError } from "../lib/httpClient.js";

function extractStatusHistory(changelog) {
  const events = [];
  for (const history of changelog?.histories || []) {
    for (const item of history.items || []) {
      if (item.field === "status") {
        events.push({
          from: item.fromString,
          to: item.toString,
          at: history.created,
          author: history.author?.displayName || "unknown",
        });
      }
    }
  }
  // Jira returns histories oldest-first already, but sort defensively.
  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  return events;
}

/**
 * Fetches a Jira ticket's description, story points, status history and
 * comments. Returns a typed error object (rather than throwing) for 404/403
 * so callers can surface it inline without crashing a batch sync.
 */
export async function getTicket(key) {
  const cfg = readConfig();
  const client = getJiraClient();

  let issueRes;
  try {
    issueRes = await client.get(`/rest/api/3/issue/${encodeURIComponent(key)}`, {
      params: { expand: "changelog" },
    });
  } catch (err) {
    if (err instanceof AtlassianApiError && (err.status === 404 || err.status === 403)) {
      return {
        error: {
          type: err.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
          message:
            err.status === 404
              ? `Jira ticket ${key} was not found (deleted or mistyped).`
              : `No permission to view Jira ticket ${key}.`,
        },
      };
    }
    throw err;
  }

  const issue = issueRes.data;
  const storyPointsField = cfg.jiraStoryPointsField;

  let comments = [];
  try {
    const commentsRes = await client.get(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
      params: { maxResults: 100 },
    });
    comments = (commentsRes.data.comments || []).map((c) => ({
      id: c.id,
      author: c.author?.displayName || "unknown",
      body: adfToPlainText(c.body),
      createdAt: c.created,
      updatedAt: c.updated,
    }));
  } catch (err) {
    if (!(err instanceof AtlassianApiError && (err.status === 404 || err.status === 403))) {
      throw err;
    }
  }

  return {
    key: issue.key,
    summary: issue.fields.summary,
    description: adfToPlainText(issue.fields.description),
    status: issue.fields.status?.name || null,
    storyPoints: issue.fields[storyPointsField] ?? null,
    statusHistory: extractStatusHistory(issue.changelog),
    comments,
    error: null,
  };
}
