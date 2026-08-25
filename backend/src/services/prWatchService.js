import { listRepos, listPullRequests, getPullRequestDetails } from "./bitbucketService.js";
import { getTicket } from "./jiraService.js";
import { extractJiraKey } from "../lib/extractJiraKey.js";
import { addItemIfNew, getWatchItems, getWatchItem, saveReview } from "../store/prWatchStore.js";
import { askAi } from "./aiProviderService.js";
import { readConfig } from "../config/configStore.js";
import { AtlassianApiError } from "../lib/httpClient.js";
import { log, logError } from "../lib/logger.js";

function startOfTodayIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Fetches today's PRs across every repo in the configured workspace and records any not already seen. */
export async function pollNewPrs() {
  const cfg = readConfig();
  if (!cfg.bitbucketWorkspace || !cfg.atlassianEmail || !cfg.bitbucketApiToken) {
    return [];
  }

  const repos = await listRepos();
  const from = startOfTodayIso();
  const added = [];

  for (const repo of repos) {
    let prs;
    try {
      prs = await listPullRequests({ repo: repo.slug, from });
    } catch (err) {
      logError(`PR watch: failed to list PRs for ${repo.slug}:`, err.message);
      continue;
    }
    for (const pr of prs) {
      const created = addItemIfNew({
        repo: repo.slug,
        prId: pr.id,
        title: pr.title,
        author: pr.author,
        authorUsername: pr.authorUsername,
        state: pr.state,
        createdAt: pr.createdAt,
        sourceBranch: pr.sourceBranch,
        link: pr.link,
      });
      if (created) added.push(created);
    }
  }

  if (added.length) log(`PR watch: ${added.length} new PR(s) detected.`);
  return added;
}

export function listWatchItems() {
  return getWatchItems();
}

function buildCritiquePrompt({ repo, item, details, ticket }) {
  const linesAdded = (details.diffstat || []).reduce((s, d) => s + (d.linesAdded || 0), 0);
  const linesRemoved = (details.diffstat || []).reduce((s, d) => s + (d.linesRemoved || 0), 0);

  const evidence = {
    repo,
    prId: item.prId,
    title: item.title,
    author: item.author,
    link: item.link,
    state: item.state,
    createdAt: item.createdAt,
    sourceBranch: item.sourceBranch,
    linesAdded,
    linesRemoved,
    filesChanged: (details.diffstat || []).length,
    changedFiles: (details.diffstat || []).slice(0, 15).map((d) => d.path),
    commitMessages: (details.commits || []).slice(0, 10).map((c) => c.message),
    approvedAt: details.approvedAt,
    approvedBy: details.approvedBy,
    mergedAt: details.mergedAt,
    reviewComments: (details.comments || []).slice(0, 15).map((c) => ({ author: c.author, text: c.content })),
    jiraKey: ticket?.key || null,
    ticketSummary: ticket?.summary || null,
    ticketDescription: (ticket?.description || "").slice(0, 800),
  };

  const system = [
    "You are a principal engineer performing a same-day critique of one pull request.",
    "Be evidence-based and genuinely critical — never invent facts not present in the data, and never soften",
    "a real gap just to sound positive. Write the critique as a clean Markdown document with the exact section",
    "headings requested, using short paragraphs or bullet points.",
  ].join(" ");

  const prompt = `Critique pull request #${item.prId} ("${item.title}") in repo "${repo}", authored by ${item.author}.

## Evidence
${JSON.stringify(evidence, null, 2)}

Produce a Markdown document with exactly these sections, in this order:

# PR Critique — #${item.prId} ${item.title}
One-line byline: author, repo, state, and linked ticket key if any.

## Code Change Assessment
Assess the size, scope, and coherence of the change from the diffstat/files/commits. Flag risk signals
(e.g. very large diff, unrelated files bundled together, vague commit messages) grounded in the evidence.

## Review Quality Critique
Critically assess how well this PR was reviewed — comment count and substance, whether approval happened
without any comments (rubber-stamping), turnaround time between creation and approval/merge if available.
Quote 1-2 actual review comments if present, or say plainly if review was thin or absent.

## Ticket Alignment
Whether the PR's change plausibly matches the linked ticket's description/summary. If there is no linked
ticket, say so plainly instead of speculating.

## Performance Signal
What this single PR suggests about the author's work on this occasion — one data point, not an overall
verdict. Be specific and grounded in the evidence above.

## Recommendations
A numbered list of 1-3 concrete, actionable suggestions for the author and/or reviewers.

Keep the whole document under 450 words. No content outside these sections, no generic filler.`;

  return { system, prompt };
}

export async function reviewWatchedPr({ repo, prId }) {
  const cfg = readConfig();
  const usingClaudeSubscription = cfg.aiProvider === "claude" && cfg.aiUseClaudeSubscription;
  if (!cfg.aiProvider || (!usingClaudeSubscription && !cfg.aiApiKey)) {
    throw new AtlassianApiError("AI agent is not configured. Fill in Settings first.", 400, "AI_NOT_CONFIGURED");
  }

  const item = getWatchItem(repo, prId);
  if (!item) throw new AtlassianApiError("PR not found in today's watch list.", 404, "NOT_FOUND");

  const details = await getPullRequestDetails({ repo, id: prId });
  const { key: jiraKey } = extractJiraKey(item.sourceBranch, item.title);
  let ticket = null;
  if (jiraKey) {
    const t = await getTicket(jiraKey);
    if (!t.error) ticket = { key: jiraKey, summary: t.summary, description: t.description };
  }

  const { system, prompt } = buildCritiquePrompt({ repo, item, details, ticket });

  const review = await askAi({
    provider: cfg.aiProvider,
    apiKey: cfg.aiApiKey,
    model: cfg.aiModel,
    system,
    prompt,
    useClaudeSubscription: usingClaudeSubscription,
  });

  return saveReview(repo, prId, review);
}
