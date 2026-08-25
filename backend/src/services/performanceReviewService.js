import { readConfig } from "../config/configStore.js";
import { getStore } from "../store/recordStore.js";
import { askAi } from "./aiProviderService.js";
import { AtlassianApiError } from "../lib/httpClient.js";

const MAX_PRS_IN_PROMPT = 30;
const MAX_COMMENTS_PER_PR = 3;
const COMMENT_EXCERPT_LENGTH = 200;

function matchesAuthor(record, author) {
  const needle = author.trim().toLowerCase();
  return (
    (record.author || "").toLowerCase() === needle || (record.authorUsername || "").toLowerCase() === needle
  );
}

function withinRange(iso, from, to) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

function daysBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000);
}

/** Group all records (any author) by jiraKey so rework can be traced across PRs. */
function groupByTicket(allRecords) {
  const groups = new Map();
  for (const record of allRecords) {
    if (!record.jiraKey) continue;
    if (!groups.has(record.jiraKey)) groups.set(record.jiraKey, []);
    groups.get(record.jiraKey).push(record);
  }
  return groups;
}

/**
 * For each reopen event on a ticket this user touched, find the next PR opened
 * afterward (by anyone) and report the turnaround time — this is the best available
 * proxy for "how long a bug took to get a follow-up PR" given the data on hand.
 */
function computeReworkEvents(userRecords, ticketGroups) {
  const userTicketKeys = new Set(userRecords.map((r) => r.jiraKey).filter(Boolean));
  const events = [];

  for (const jiraKey of userTicketKeys) {
    const group = ticketGroups.get(jiraKey) || [];
    const reopenDates = [...new Set(group.flatMap((r) => r.reopenDates || []))].sort();
    if (!reopenDates.length) continue;

    const prTimestamps = group.map((r) => ({ createdAt: r.createdAt, author: r.author })).sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    for (const reopenDate of reopenDates) {
      const nextPr = prTimestamps.find((pr) => new Date(pr.createdAt) > new Date(reopenDate));
      events.push({
        jiraKey,
        reopenDate,
        nextPrCreatedAt: nextPr?.createdAt || null,
        nextPrAuthor: nextPr?.author || null,
        daysToReworkPr: nextPr ? Number(daysBetween(reopenDate, nextPr.createdAt).toFixed(1)) : null,
      });
    }
  }

  return events;
}

function buildMetrics(userRecords, ticketGroups) {
  const total = userRecords.length;
  const merged = userRecords.filter((r) => r.state === "MERGED");
  const approved = userRecords.filter((r) => r.approvedAt);
  const linkedTickets = new Set(userRecords.filter((r) => r.jiraKey).map((r) => r.jiraKey));
  const storyPoints = userRecords.reduce((sum, r) => sum + (r.storyPoints || 0), 0);
  const totalComments = userRecords.reduce((sum, r) => sum + (r.comments?.length || 0), 0);
  const linesAdded = userRecords.reduce(
    (sum, r) => sum + (r.diffstat || []).reduce((s, d) => s + (d.linesAdded || 0), 0),
    0
  );
  const linesRemoved = userRecords.reduce(
    (sum, r) => sum + (r.diffstat || []).reduce((s, d) => s + (d.linesRemoved || 0), 0),
    0
  );
  const reworkEvents = computeReworkEvents(userRecords, ticketGroups);
  const resolvedRework = reworkEvents.filter((e) => e.daysToReworkPr !== null);
  const avgDaysToReworkPr = resolvedRework.length
    ? Number((resolvedRework.reduce((s, e) => s + e.daysToReworkPr, 0) / resolvedRework.length).toFixed(1))
    : null;

  return {
    totalPRs: total,
    mergedPRs: merged.length,
    approvedPRs: approved.length,
    approvalRate: total ? Number((approved.length / total).toFixed(2)) : 0,
    linkedTickets: linkedTickets.size,
    storyPoints,
    totalReviewComments: totalComments,
    avgReviewCommentsPerPr: total ? Number((totalComments / total).toFixed(1)) : 0,
    linesAdded,
    linesRemoved,
    reopenedTicketCount: reworkEvents.length,
    avgDaysToReworkPr,
    reworkEvents: reworkEvents.slice(0, 10),
  };
}

function buildPrompt(author, from, to, metrics, userRecords) {
  const sample = userRecords.slice(0, MAX_PRS_IN_PROMPT).map((r) => ({
    repo: r.repo,
    prId: r.prId,
    title: r.title,
    state: r.state,
    createdAt: r.createdAt,
    mergedAt: r.mergedAt,
    linesAdded: (r.diffstat || []).reduce((s, d) => s + (d.linesAdded || 0), 0),
    linesRemoved: (r.diffstat || []).reduce((s, d) => s + (d.linesRemoved || 0), 0),
    filesChanged: (r.diffstat || []).length,
    approved: Boolean(r.approvedAt),
    reviewCommentCount: r.comments?.length || 0,
    reviewCommentSamples: (r.comments || [])
      .slice(0, MAX_COMMENTS_PER_PR)
      .map((c) => (c.content || "").slice(0, COMMENT_EXCERPT_LENGTH)),
    jiraKey: r.jiraKey,
    ticketStatus: r.ticketStatus,
    reopened: r.reopened,
    reopenCount: r.reopenCount,
  }));

  const system = [
    "You are a senior engineering manager writing a fair, evidence-based performance review",
    "of one engineer, using only the PR and Jira data provided. Do not invent facts not present",
    "in the data. Be specific and cite PR ids / ticket keys when making a claim.",
  ].join(" ");

  const prompt = `Review engineer "${author}" for the period ${from || "(all time)"} to ${to || "(all time)"}.

Aggregate metrics (computed from all their PRs/tickets in range):
${JSON.stringify(metrics, null, 2)}

Sample of up to ${MAX_PRS_IN_PROMPT} PRs (most recent ${sample.length} of ${userRecords.length} total), including review
comment excerpts where available:
${JSON.stringify(sample, null, 2)}

Write a performance review covering, as separate sections:
1. Delivery — volume and consistency of PRs/tickets shipped, story points delivered.
2. Code quality — infer cleanliness from review comment volume/tone and PR size; call out any
   recurring themes in review feedback (e.g. repeated requests for the same kind of fix).
3. Rework / bug rate — how often this engineer's tickets got reopened and how long it took to
   land a follow-up PR (see reworkEvents and avgDaysToReworkPr); flag if this is a concern.
4. Overall summary with 2-3 concrete, actionable suggestions.

Keep it concise (under 400 words) and avoid generic filler.`;

  return { system, prompt };
}

export async function reviewUser({ author, from, to }) {
  if (!author) throw new AtlassianApiError("author is required", 400, "MISSING_AUTHOR");

  const cfg = readConfig();
  const usingClaudeSubscription = cfg.aiProvider === "claude" && cfg.aiUseClaudeSubscription;
  if (!cfg.aiProvider || (!usingClaudeSubscription && !cfg.aiApiKey)) {
    throw new AtlassianApiError("AI agent is not configured. Fill in Settings first.", 400, "AI_NOT_CONFIGURED");
  }

  const store = await getStore();
  const allRecords = store.getAll();
  const ticketGroups = groupByTicket(allRecords);
  const userRecords = allRecords
    .filter((r) => matchesAuthor(r, author))
    .filter((r) => (from || to ? withinRange(r.createdAt, from, to) : true))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!userRecords.length) {
    throw new AtlassianApiError(
      `No synced PRs found for "${author}" in the given range. Run a Sync first.`,
      404,
      "NO_DATA"
    );
  }

  const metrics = buildMetrics(userRecords, ticketGroups);
  const { system, prompt } = buildPrompt(author, from, to, metrics, userRecords);

  const review = await askAi({
    provider: cfg.aiProvider,
    apiKey: cfg.aiApiKey,
    model: cfg.aiModel,
    system,
    prompt,
    useClaudeSubscription: usingClaudeSubscription,
  });

  return { author, from: from || null, to: to || null, provider: cfg.aiProvider, metrics, review };
}

export async function listAuthors() {
  const store = await getStore();
  const seen = new Map();
  for (const r of store.getAll()) {
    if (!r.author && !r.authorUsername) continue;
    const key = (r.authorUsername || r.author).toLowerCase();
    if (!seen.has(key)) seen.set(key, { author: r.author, authorUsername: r.authorUsername });
  }
  return [...seen.values()].sort((a, b) => (a.author || "").localeCompare(b.author || ""));
}
