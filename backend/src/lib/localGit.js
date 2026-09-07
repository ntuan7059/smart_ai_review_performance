import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const COMMIT_HASH_RE = /^[0-9a-f]{7,40}$/i;

export function assertValidCommitHash(hash) {
  if (!COMMIT_HASH_RE.test(hash)) {
    throw new Error(`Invalid commit hash: ${hash}`);
  }
}

function truncateDiff(text, maxBytes) {
  if (!text || text.length <= maxBytes) return text || "";
  return `${text.slice(0, maxBytes)}\n\n... [diff truncated at ${maxBytes} bytes]`;
}

/**
 * Resolve a local git clone for a Bitbucket repo slug.
 * Looks under {localRepoRoot}/{repoSlug} or {localRepoRoot}/{workspace}/{repoSlug}.
 */
export function resolveLocalRepoPath(localRepoRoot, repoSlug, workspace) {
  if (!localRepoRoot || !repoSlug) return null;
  const root = path.resolve(localRepoRoot);
  const candidates = [path.join(root, repoSlug)];
  if (workspace) candidates.push(path.join(root, workspace, repoSlug));

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) continue;
    if (fs.existsSync(path.join(resolved, ".git"))) return resolved;
  }
  return null;
}

/** Whether git is available and localRepoRoot exists. */
export async function probeLocalGit(localRepoRoot) {
  if (!localRepoRoot) return { available: false, reason: "not_configured" };
  try {
    await execFileAsync("git", ["--version"], { timeout: 5000 });
  } catch {
    return { available: false, reason: "git_not_installed" };
  }
  const root = path.resolve(localRepoRoot);
  if (!fs.existsSync(root)) return { available: false, reason: "path_missing", path: root };
  return { available: true, path: root };
}

/** Run `git fetch --prune` on a local clone. */
export async function fetchLocalRepo(repoPath, { remote = "origin", timeoutMs = 120000 } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("git", ["fetch", "--prune", remote], {
      cwd: repoPath,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { ok: true, detail: (stdout || stderr || "").trim() || "ok" };
  } catch (err) {
    const message = err.stderr?.toString?.() || err.message || "git fetch failed";
    return { ok: false, error: message.trim() };
  }
}

/** Unified diff for one commit via `git show -p` (no network). */
export async function showCommitDiff(repoPath, hash, maxBytes) {
  assertValidCommitHash(hash);
  const { stdout } = await execFileAsync(
    "git",
    ["show", hash, "-p", "--no-color", "--format=commit %H%nAuthor: %an%nDate: %ad%n%n%B%n"],
    { cwd: repoPath, maxBuffer: Math.max(maxBytes * 2, 512000), timeout: 45000 }
  );
  return truncateDiff(stdout, maxBytes);
}

function isMissingCommitError(err) {
  const msg = (err.stderr?.toString?.() || err.message || "").toLowerCase();
  return (
    msg.includes("bad object") ||
    msg.includes("unknown revision") ||
    msg.includes("invalid object name") ||
    msg.includes("does not have any commits") ||
    msg.includes("not a valid object name")
  );
}

/**
 * `git show` with a single `git fetch` retry when the commit object is missing locally.
 * Used only as a fallback after the proactive per-repo fetch at review start.
 */
export async function showCommitDiffWithFetchFallback(repoPath, hash, maxBytes) {
  try {
    return await showCommitDiff(repoPath, hash, maxBytes);
  } catch (err) {
    if (!isMissingCommitError(err)) throw err;
    const fetched = await fetchLocalRepo(repoPath);
    if (!fetched.ok) {
      throw new Error(`Commit ${hash} not found locally and git fetch failed: ${fetched.error}`);
    }
    return await showCommitDiff(repoPath, hash, maxBytes);
  }
}

/** Fetch every clone once before reading commit diffs. */
export async function syncLocalRepos(repoPathsBySlug) {
  const results = {};
  for (const [slug, repoPath] of repoPathsBySlug) {
    results[slug] = await fetchLocalRepo(repoPath);
  }
  return results;
}
