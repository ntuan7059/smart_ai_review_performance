import { readConfig } from "../config/configStore.js";
import { AtlassianApiError } from "../lib/httpClient.js";
import {
  probeLocalGit,
  resolveLocalRepoPath,
  showCommitDiffWithFetchFallback,
  syncLocalRepos,
} from "../lib/localGit.js";
import { log, logError } from "../lib/logger.js";

export const MAX_DIFF_BYTES_PER_COMMIT = 24000;
const COMMIT_MESSAGE_MAX = 300;

function uniqueRepoSlugs(records) {
  return [...new Set(records.map((r) => r.repo).filter(Boolean))];
}

function buildRepoPathMap(repoSlugs, localRepoRoot, workspace) {
  const paths = new Map();
  const missing = [];

  for (const slug of repoSlugs) {
    const repoPath = resolveLocalRepoPath(localRepoRoot, slug, workspace);
    if (!repoPath) missing.push(slug);
    else paths.set(slug, repoPath);
  }

  return { paths, missing };
}

function localGitUnavailableMessage(gitProbe) {
  if (gitProbe.reason === "git_not_installed") {
    return "git is not installed or not on PATH on the machine running the backend.";
  }
  if (gitProbe.reason === "path_missing") {
    return `local repo root does not exist: ${gitProbe.path}`;
  }
  return "local git clones root is not configured.";
}

function createCodeReviewSummary(localRepoRoot) {
  return {
    prsWithDiffs: 0,
    commitsFetched: 0,
    reposSynced: 0,
    reposSyncFailed: 0,
    sourceBreakdown: { localGit: 0, failed: 0 },
    localRepoRoot,
    diffSource: "local-git-only",
  };
}

function toPublicCommitDiff(entry) {
  return {
    hash: entry.hash,
    message: entry.message,
    source: entry.source,
    diff: entry.diff,
    error: entry.error,
  };
}

/**
 * Validate local git setup and return repo slug → clone path map.
 * Commit diffs are never fetched from Bitbucket — only `git show` on local clones.
 */
export function resolveLocalGitContext(userRecords) {
  const cfg = readConfig();
  const localRepoRoot = cfg.localRepoRoot?.trim();
  if (!localRepoRoot) {
    throw new AtlassianApiError(
      "Local git clones root is required for AI Review. Set it in Settings → Show advanced → Local git clones root.",
      400,
      "LOCAL_REPO_NOT_CONFIGURED"
    );
  }

  const { paths, missing } = buildRepoPathMap(
    uniqueRepoSlugs(userRecords),
    localRepoRoot,
    cfg.bitbucketWorkspace
  );

  if (missing.length) {
    throw new AtlassianApiError(
      `No local git clone found for: ${missing.join(", ")}. ` +
        `Clone each repo under ${localRepoRoot}/{repo-slug} (or ${localRepoRoot}/{workspace}/{repo-slug}).`,
      400,
      "LOCAL_REPO_MISSING"
    );
  }

  return { localRepoRoot, workspace: cfg.bitbucketWorkspace, repoPaths: paths };
}

async function assertLocalGitEnvironment(localRepoRoot) {
  const gitProbe = await probeLocalGit(localRepoRoot);
  if (!gitProbe.available) {
    throw new AtlassianApiError(
      `Cannot read commit diffs locally: ${localGitUnavailableMessage(gitProbe)}`,
      400,
      "LOCAL_GIT_UNAVAILABLE"
    );
  }
}

async function readCommitDiffForRecord(record, repoPath) {
  const commitDiffs = [];
  const summary = { localGit: 0, failed: 0 };

  for (const commit of record.commits || []) {
    const hash = commit.hash;
    if (!hash) continue;

    const entry = {
      hash,
      message: (commit.message || "").slice(0, COMMIT_MESSAGE_MAX),
      author: commit.author,
      date: commit.date,
      source: "local-git",
      diff: null,
      error: null,
    };

    try {
      entry.diff = await showCommitDiffWithFetchFallback(
        repoPath,
        hash,
        MAX_DIFF_BYTES_PER_COMMIT
      );
      summary.localGit += 1;
    } catch (err) {
      entry.error = err.message;
      summary.failed += 1;
      logError(`Local git diff failed for ${record.repo}@${hash}:`, err.message);
    }

    commitDiffs.push(entry);
  }

  return { commitDiffs, summary, localRepoPath: repoPath };
}

/**
 * Prepare local clones (git fetch per repo) and attach per-commit diffs to review evidence.
 */
export async function attachCommitDiffsToEvidence(evidence, userRecords) {
  const { localRepoRoot, repoPaths } = resolveLocalGitContext(userRecords);
  await assertLocalGitEnvironment(localRepoRoot);

  const syncResults = await syncLocalRepos(repoPaths);
  const codeReview = createCodeReviewSummary(localRepoRoot);
  codeReview.reposSynced = repoPaths.size;
  codeReview.reposSyncFailed = Object.values(syncResults).filter((r) => !r.ok).length;

  for (const [slug, result] of Object.entries(syncResults)) {
    if (result.ok) log(`Local git: synced ${slug}`);
    else logError(`Local git: fetch failed for ${slug}:`, result.error);
  }

  const recordByKey = new Map(userRecords.map((r) => [`${r.repo}#${r.prId}`, r]));
  const evidenceWithDiffs = [];

  for (const item of evidence) {
    const record = recordByKey.get(`${item.repo}#${item.prId}`);
    if (!record) {
      evidenceWithDiffs.push(item);
      continue;
    }

    const repoPath = repoPaths.get(record.repo);
    const { commitDiffs, summary, localRepoPath } = await readCommitDiffForRecord(record, repoPath);

    codeReview.prsWithDiffs += 1;
    codeReview.commitsFetched += commitDiffs.filter((c) => c.diff).length;
    codeReview.sourceBreakdown.localGit += summary.localGit;
    codeReview.sourceBreakdown.failed += summary.failed;

    evidenceWithDiffs.push({
      ...item,
      commitDiffs: commitDiffs.map(toPublicCommitDiff),
      localRepoPath,
      diffSource: "local-git",
    });
  }

  return { evidence: evidenceWithDiffs, codeReview };
}

/**
 * Same as attachCommitDiffsToEvidence but never throws — used by per-PR review so
 * missing local clones still allow a ticket/diffstat-based assessment.
 */
export async function tryAttachCommitDiffsToEvidence(evidence, userRecords) {
  const cfg = readConfig();
  if (!cfg.localRepoRoot?.trim()) {
    return { evidence, codeReview: null };
  }
  try {
    return await attachCommitDiffsToEvidence(evidence, userRecords);
  } catch (err) {
    logError("Skipping local git diffs for PR review:", err.message);
    return { evidence, codeReview: { skipped: true, reason: err.message } };
  }
}

