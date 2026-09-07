import { MAX_DIFF_BYTES_PER_COMMIT } from "./localGitDiffService.js";

function hasCommitDiffs(evidence) {
  return evidence.some((e) => (e.commitDiffs || []).some((c) => c.diff));
}

export function buildPerformanceReviewPrompt(author, from, to, metrics, evidence, codeReview) {
  const commitDiffsAvailable = hasCommitDiffs(evidence);

  const system = [
    "You are a senior staff engineer performing a code-aware performance review of one engineer.",
    "Use the provided commit diffs (unified patch format) as primary evidence for code quality — cite specific",
    "files, patterns, risks, and strengths you observe in the diffs. Also use metrics, review comments, and ticket data.",
    "Never invent facts not present in the evidence. Every code-quality claim must reference a PR id and ideally a file path.",
    "Write as a clean Markdown document with the exact section headings requested.",
  ].join(" ");

  const prompt = `Review engineer "${author}" for the period ${from || "(all time)"} to ${to || "(all time)"}.

## Code review coverage
${JSON.stringify(codeReview, null, 2)}
Commit diffs were read from local git clones only (\`git show\`) after \`git fetch\` per repo.
Coverage: ${codeReview.prsWithDiffs} PR(s), ${codeReview.commitsFetched} commit diff(s).
Each diff is truncated at ${MAX_DIFF_BYTES_PER_COMMIT} bytes when very large. Root: ${codeReview.localRepoRoot}.

## Aggregate metrics (authored PRs — do not recompute)
${JSON.stringify(metrics, null, 2)}

## Evidence packet (authored PRs with commit diffs where available)
${evidence.length} PRs included. Fields commitDiffs[].diff contain unified diffs per commit.
${JSON.stringify(evidence, null, 2)}

Produce a Markdown document with exactly these sections, in this order:

# Performance Review — ${author}
One-line byline: period, PR count, and whether commit diffs were analyzed.

## Executive Summary
2-4 sentences referencing at least one delivery metric and one code-quality observation from the diffs.

## Delivery
Volume and consistency of PRs/tickets shipped and story points. Cite specific PR ids.

## Code Quality (from commit diffs)
${commitDiffsAvailable
    ? "Analyze the actual code changes in commitDiffs — structure, readability, error handling, tests, security smells, scope discipline. Quote or paraphrase specific files/lines from the diffs. Note recurring patterns across PRs. If a PR has no diff attached, say so and rely only on review comments for that PR."
    : "No commit diffs were available — state this plainly and use only review comments and diff sizes. Do not claim to have read source code."}
Also incorporate review comment themes where relevant (quote 1-2 verbatim with PR id).

## Rework & Bug Turnaround
Reopened tickets and follow-up PR timing (reworkEvents / avgDaysToReworkPr). Name ticket keys. If none, say plainly.

## Recommendations
2-4 numbered, actionable suggestions grounded in diff observations or metrics above.

## Evidence Log
Bullet list: "PR #<id> (<repo>) — <reason>" or "<TICKET-KEY> — <reason>", including file paths for code-quality citations.

Keep under 800 words excluding Evidence Log. No filler.`;

  return { system, prompt };
}

export function buildMemberReviewFromPrReviewsPrompt(author, from, to, metrics, prReviews, coverage) {
  const system = [
    "You are a senior staff engineer writing a performance review of one engineer.",
    "Your primary evidence is the already-scored pull-request reviews in the packet — do not re-litigate",
    "code you cannot see. Synthesize recurring strengths/weaknesses, whether scores match ticket complexity,",
    "and delivery metrics. Never invent PRs, scores, or comments that are not in the packet.",
    "Write as a clean Markdown document with the exact section headings requested.",
  ].join(" ");

  const prompt = `Review engineer "${author}" for the period ${from || "(all time)"} to ${to || "(all time)"}.

## Coverage
${JSON.stringify(coverage, null, 2)}
Only PRs that already have a saved structured review are included. Do not assume unreviewed PRs were good or bad.

## Aggregate metrics (authored synced PRs — do not recompute)
${JSON.stringify(metrics, null, 2)}

## Saved PR reviews (${prReviews.length})
Each item is a prior per-PR assessment (score 1–10, complexity, completeness, strengths, weaknesses).
${JSON.stringify(prReviews, null, 2)}

Produce a Markdown document with exactly these sections, in this order:

# Performance Review — ${author}
One-line byline: period, saved-PR-review count, average score if present.

## Executive Summary
2-4 sentences. Reference the average score (or say scores were missing) and one recurring strength or weakness.

## Delivery
Volume of PRs/tickets/story points from metrics. Cite PR ids from the saved reviews.

## Quality of work (from saved PR reviews)
Synthesize strengths and weaknesses across PRs. Call out whether high-complexity tickets were completed well
(codeCompleteness vs ticketComplexity) or whether simple tickets were over-scored. Quote 2-4 bullets from the saved reviews with PR ids.

## Scores
Comment on the score distribution and any outliers (name the PR). If coverage.unreviewedCount > 0, note that the picture is incomplete.

## Rework & Bug Turnaround
Reopened tickets and follow-up PR timing from metrics. Name ticket keys. If none, say plainly.

## Recommendations
2-4 numbered suggestions grounded in the saved PR reviews or metrics.

## Evidence Log
Bullet list: "PR #<id> (<repo>) score <n> — <one-line reason>".

Keep under 800 words excluding Evidence Log. No filler.`;

  return { system, prompt };
}
