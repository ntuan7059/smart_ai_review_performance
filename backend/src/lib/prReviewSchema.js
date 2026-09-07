export const COMPLEXITY = new Set(["low", "medium", "high"]);
export const COMPLETENESS = new Set(["incomplete", "adequate", "solid", "excellent"]);

const MAX_BULLETS = 3;
const MAX_BULLET_CHARS = 110;
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

function asStringArray(value, max = MAX_BULLETS) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clipText(typeof item === "string" ? item : String(item || ""), MAX_BULLET_CHARS))
    .filter(Boolean)
    .slice(0, max);
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(10, Math.max(1, n)) * 10) / 10;
}

function pickEnum(value, allowed, fallback) {
  const key = String(value || "").trim().toLowerCase();
  return allowed.has(key) ? key : fallback;
}

/** Normalize the structured assessment the model returns. */
export function normalizeAssessment(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    strengths: asStringArray(src.strengths),
    weaknesses: asStringArray(src.weaknesses),
    score: clampScore(src.score),
    scoreRationale: clipText(src.scoreRationale, MAX_RATIONALE_CHARS),
    ticketComplexity: pickEnum(src.ticketComplexity, COMPLEXITY, "medium"),
    codeCompleteness: pickEnum(src.codeCompleteness, COMPLETENESS, "adequate"),
    summary: clipText(src.summary, MAX_SUMMARY_CHARS),
  };
}

export function formatPrReviewMarkdown(review) {
  const scoreLabel = review.score == null ? "n/a" : `${review.score}/10`;
  const strengths = (review.strengths || []).map((s) => `- ${s}`).join("\n") || "- (none recorded)";
  const weaknesses = (review.weaknesses || []).map((s) => `- ${s}`).join("\n") || "- (none recorded)";
  const ticket = review.jiraKey
    ? `${review.jiraKey}${review.storyPoints != null ? ` (${review.storyPoints} pts)` : ""}`
    : "none";

  return [
    `# PR Review — #${review.prId} ${review.title || ""}`.trim(),
    `${review.author || "unknown"} · ${review.repo} · ${review.state || ""} · ticket ${ticket}`.trim(),
    "",
    `## Score: ${scoreLabel}`,
    review.scoreRationale || "No rationale recorded.",
    "",
    `Ticket complexity: **${review.ticketComplexity}** · Code completeness: **${review.codeCompleteness}**`,
    "",
    "## Summary",
    review.summary || "No summary recorded.",
    "",
    "## Strengths",
    strengths,
    "",
    "## Weaknesses",
    weaknesses,
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
