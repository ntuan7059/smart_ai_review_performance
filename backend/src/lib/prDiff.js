export const MAX_PR_DIFF_BYTES = 48_000;
export const MAX_FILE_DIFF_BYTES = 12_000;
export const MAX_DIFF_FILES = 20;

const SKIP_BASENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "npm-shrinkwrap.json",
  "composer.lock",
  "gemfile.lock",
  "cargo.lock",
  "poetry.lock",
  "bun.lock",
  "bun.lockb",
  "go.sum",
]);

const SKIP_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".jar",
  ".war",
  ".mp4",
  ".mp3",
  ".mov",
  ".map",
  ".lock",
]);

const SKIP_DIR_PARTS = new Set(["node_modules", "dist", "build", ".next", "coverage", "vendor"]);

function basename(filePath) {
  const parts = String(filePath || "").split("/");
  return parts[parts.length - 1] || filePath;
}

function extension(filePath) {
  const name = basename(filePath).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : "";
}

export function skipDiffPathReason(filePath) {
  const path = String(filePath || "");
  const base = basename(path).toLowerCase();
  if (SKIP_BASENAMES.has(base)) return "lockfile";
  if (base.endsWith(".min.js") || base.endsWith(".min.css")) return "minified";
  if (SKIP_EXTENSIONS.has(extension(path))) return "binary-or-asset";
  const dirs = path.split("/").map((p) => p.toLowerCase());
  if (dirs.some((dir) => SKIP_DIR_PARTS.has(dir))) return "generated-dir";
  return null;
}

function skipPatchReason(filePath, patch) {
  const pathReason = skipDiffPathReason(filePath);
  if (pathReason) return pathReason;
  if (/^Binary files /m.test(patch) || /GIT binary patch/.test(patch)) return "binary";
  return null;
}

function filePathFromHeader(headerLine) {
  const match = headerLine.match(/^diff --git a\/(.+) b\/(.+)$/);
  if (!match) return "unknown";
  const [, aPath, bPath] = match;
  if (bPath && bPath !== "/dev/null") return bPath;
  if (aPath && aPath !== "/dev/null") return aPath;
  return bPath || aPath || "unknown";
}

export function parseUnifiedDiffFiles(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];

  const parts = text.split(/(?=^diff --git )/m);
  const files = [];
  for (const part of parts) {
    if (!part.startsWith("diff --git ")) continue;
    const headerLine = part.split("\n", 1)[0];
    files.push({ path: filePathFromHeader(headerLine), patch: part });
  }
  return files;
}

function truncatePatch(patch, maxBytes) {
  if (patch.length <= maxBytes) return { text: patch, truncated: false };
  return {
    text: `${patch.slice(0, maxBytes)}\n\n... [file truncated at ${maxBytes} bytes]\n`,
    truncated: true,
  };
}

/**
 * Filter a Bitbucket PR unified diff for an AI prompt: drop lockfiles/binaries,
 * cap files and bytes, keep enough source to review completeness.
 */
export function preparePrDiffForReview(rawDiff, options = {}) {
  const maxTotalBytes = options.maxTotalBytes ?? MAX_PR_DIFF_BYTES;
  const maxFileBytes = options.maxFileBytes ?? MAX_FILE_DIFF_BYTES;
  const maxFiles = options.maxFiles ?? MAX_DIFF_FILES;
  const raw = typeof rawDiff === "string" ? rawDiff : "";
  const files = parseUnifiedDiffFiles(raw);

  const filesIncluded = [];
  const filesSkipped = [];
  const chunks = [];
  let includedBytes = 0;
  let truncated = false;

  if (!files.length && raw.trim()) {
    const { text, truncated: cut } = truncatePatch(raw, maxTotalBytes);
    return {
      source: "bitbucket-pr-diff",
      text,
      filesIncluded: [{ path: "(unparsed)", bytes: text.length }],
      filesSkipped: [],
      truncated: cut,
      rawBytes: raw.length,
      includedBytes: text.length,
      fileCountRaw: 0,
    };
  }

  for (const file of files) {
    const reason = skipPatchReason(file.path, file.patch);
    if (reason) {
      filesSkipped.push({ path: file.path, reason });
      continue;
    }
    if (filesIncluded.length >= maxFiles) {
      filesSkipped.push({ path: file.path, reason: "file-limit" });
      truncated = true;
      continue;
    }
    if (includedBytes >= maxTotalBytes) {
      filesSkipped.push({ path: file.path, reason: "size-limit" });
      truncated = true;
      continue;
    }

    const budget = Math.min(maxFileBytes, maxTotalBytes - includedBytes);
    const { text, truncated: cut } = truncatePatch(file.patch, budget);
    if (cut) truncated = true;
    chunks.push(text);
    includedBytes += text.length;
    filesIncluded.push({ path: file.path, bytes: text.length });
  }

  return {
    source: "bitbucket-pr-diff",
    text: chunks.join("\n"),
    filesIncluded,
    filesSkipped,
    truncated,
    rawBytes: raw.length,
    includedBytes,
    fileCountRaw: files.length,
  };
}

export function summarizeDiffCoverage(prepared, extra = {}) {
  if (!prepared) return null;
  return {
    source: prepared.source || "bitbucket-pr-diff",
    included: (prepared.filesIncluded || []).map((f) => f.path),
    skipped: (prepared.filesSkipped || []).slice(0, 30).map((f) => `${f.path} (${f.reason})`),
    truncated: Boolean(prepared.truncated),
    includedBytes: prepared.includedBytes || 0,
    rawBytes: prepared.rawBytes || 0,
    error: extra.error || prepared.error || null,
  };
}
