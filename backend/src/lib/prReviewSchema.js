export const COMPLEXITY = new Set(["low", "medium", "high"]);
export const COMPLETENESS = new Set(["incomplete", "adequate", "solid", "excellent"]);
export const PR_REVIEW_SIGNALS = new Set([
  "tight-scope",
  "bloated-scope",
  "tests-present",
  "tests-missing",
  "good-error-handling",
  "weak-error-handling",
  "clear-diff",
  "hard-to-review",
  "security-risk",
  "matches-ticket",
  "partial-ticket",
]);

const MAX_STRENGTHS = 3;
const MAX_IMPROVEMENTS = 4;
const MAX_BULLET_CHARS = 140;
const MAX_SUMMARY_CHARS = 220;
const MAX_RATIONALE_CHARS = 160;

export function clipText(value, max) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  const kept = (at > max * 0.55 ? cut.slice(0, at) : cut).trimEnd();
  return `${kept}…`;
}

function asStringArray(value, max) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clipText(typeof item === "string" ? item : String(item || ""), MAX_BULLET_CHARS))
    .filter(Boolean)
    .slice(0, max);
}

function asSignals(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const key = String(item || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (!PR_REVIEW_SIGNALS.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.slice(0, 8);
}

/** Base score from completeness × complexity. The model never picks this number. */
export const SCORE_MATRIX = {
  incomplete: { low: 3, medium: 3, high: 4 },
  adequate: { low: 5, medium: 6, high: 7 },
  solid: { low: 6, medium: 7, high: 8 },
  excellent: { low: 7, medium: 8, high: 9 },
};

const SCORE_PENALTIES = {
  "tests-missing": 1,
  "security-risk": 1,
};

function pickEnum(value, allowed, fallback) {
  const key = String(value || "").trim().toLowerCase();
  return allowed.has(key) ? key : fallback;
}

export function computePrReviewScore({
  ticketComplexity,
  codeCompleteness,
  signals = [],
  truncated = false,
  missingDiff = false,
} = {}) {
  const complexity = COMPLEXITY.has(ticketComplexity) ? ticketComplexity : "medium";
  const completeness = COMPLETENESS.has(codeCompleteness) ? codeCompleteness : "adequate";
  const base = SCORE_MATRIX[completeness][complexity];
  const penalties = [];
  const seen = new Set();
  for (const signal of signals) {
    const amount = SCORE_PENALTIES[signal];
    if (!amount || seen.has(signal)) continue;
    seen.add(signal);
    penalties.push({ signal, delta: -amount });
  }
  const uncapped = base + penalties.reduce((sum, item) => sum + item.delta, 0);
  let appliedCap = null;
  let capReason = null;
  if (missingDiff) {
    appliedCap = 6;
    capReason = "missing-diff";
  } else if (truncated) {
    appliedCap = 7;
    capReason = "truncated-diff";
  }
  let score = uncapped;
  if (appliedCap != null && score > appliedCap) score = appliedCap;
  score = Math.max(1, Math.min(10, score));
  return {
    method: "matrix",
    ticketComplexity: complexity,
    codeCompleteness: completeness,
    base,
    penalties,
    uncapped,
    appliedCap,
    capReason,
    score,
  };
}

export function formatScoreBreakdown(breakdown) {
  if (!breakdown || breakdown.score == null) return "";
  const bits = [`${breakdown.base} (${breakdown.codeCompleteness} × ${breakdown.ticketComplexity})`];
  for (const item of breakdown.penalties || []) bits.push(`− ${item.signal}`);
  if (breakdown.capReason && breakdown.uncapped > breakdown.score) {
    bits.push(breakdown.capReason === "missing-diff" ? "no-diff cap 6" : "truncated cap 7");
  }
  return `${bits.join(" · ")} → ${breakdown.score}/10`;
}

/** Normalize model labels, then compute the score. Ignores any LLM-provided score. */
export function normalizeAssessment(raw, flags = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const improvements = asStringArray(src.improvements?.length ? src.improvements : src.weaknesses, MAX_IMPROVEMENTS);
  const signals = asSignals(src.signals);
  const ticketComplexity = pickEnum(src.ticketComplexity, COMPLEXITY, "medium");
  const codeCompleteness = pickEnum(src.codeCompleteness, COMPLETENESS, "adequate");
  const scoreBreakdown = computePrReviewScore({
    ticketComplexity,
    codeCompleteness,
    signals,
    truncated: Boolean(flags.truncated),
    missingDiff: Boolean(flags.missingDiff),
  });
  return {
    strengths: asStringArray(src.strengths, MAX_STRENGTHS),
    improvements,
    weaknesses: improvements,
    signals,
    score: scoreBreakdown.score,
    scoreBreakdown,
    scoreRationale: clipText(src.scoreRationale, MAX_RATIONALE_CHARS),
    ticketComplexity,
    codeCompleteness,
    summary: clipText(src.summary, MAX_SUMMARY_CHARS),
  };
}

export function formatPrReviewMarkdown(review) {
  const scoreLabel = review.score == null ? "n/a" : `${review.score}/10`;
  const strengths = (review.strengths || []).map((s) => `- ${s}`).join("\n") || "- (none recorded)";
  const improvements =
    (review.improvements || review.weaknesses || []).map((s) => `- ${s}`).join("\n") || "- (none recorded)";
  const signals = (review.signals || []).join(", ") || "none";
  const ticket = review.jiraKey
    ? `${review.jiraKey}${review.storyPoints != null ? ` (${review.storyPoints} pts)` : ""}`
    : "none";

  return [
    `# PR Review — #${review.prId} ${review.title || ""}`.trim(),
    `${review.author || "unknown"} · ${review.repo} · ${review.state || ""} · ticket ${ticket}`.trim(),
    "",
    `## Score: ${scoreLabel}`,
    formatScoreBreakdown(review.scoreBreakdown) || review.scoreRationale || "No rationale recorded.",
    review.scoreBreakdown && review.scoreRationale ? review.scoreRationale : "",
    "",
    `Ticket complexity: **${review.ticketComplexity}** · Code completeness: **${review.codeCompleteness}**`,
    "",
    "## Summary",
    review.summary || "No summary recorded.",
    "",
    "## Strengths",
    strengths,
    "",
    "## Improvements",
    improvements,
    "",
    `Signals: ${signals}`,
  ].join("\n");
}

export function averageScore(reviews) {
  const scored = (reviews || []).map((r) => r.score).filter((s) => s != null);
  if (!scored.length) return null;
  return Math.round((scored.reduce((sum, s) => sum + s, 0) / scored.length) * 10) / 10;
}

export function countBy(reviews, field) {
  const counts = {};
  for (const r of reviews || []) {
    const key = r[field] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function countSignals(reviews) {
  const counts = {};
  for (const r of reviews || []) {
    for (const signal of r.signals || []) {
      counts[signal] = (counts[signal] || 0) + 1;
    }
  }
  return counts;
}

export function scoresByComplexity(reviews) {
  const buckets = { low: [], medium: [], high: [] };
  for (const r of reviews || []) {
    const bucket = buckets[r.ticketComplexity];
    if (!bucket || r.score == null) continue;
    bucket.push(r.score);
  }
  const out = {};
  for (const [key, scores] of Object.entries(buckets)) {
    out[key] = {
      count: scores.length,
      avgScore: scores.length
        ? Math.round((scores.reduce((sum, n) => sum + n, 0) / scores.length) * 10) / 10
        : null,
    };
  }
  return out;
}
