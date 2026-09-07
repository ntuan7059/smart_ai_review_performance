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
    "You are a staff engineer writing a performance review of ONE engineer from saved PR reviews.",
    "Do not re-read or invent code. Do not assign numeric scores. Synthesize habits with citations.",
    "A habit is a signal (or a paraphrased improvement) seen in 2+ PRs, or once if the PR is high-complexity or marked security-risk.",
    "A single nit is not a habit. Empty signals on older reviews: cluster similar improvement text; do not invent signal tags.",
    "Weight high-complexity PRs more than low-complexity ones when judging quality of work.",
    "Ignore process noise: approval rate, “PR not approved”, lockfiles, null/zero story points — unless they blocked judging the work.",
    "If coverage.unreviewedCount > 0, say the picture is incomplete. Never infer quality for unreviewed PRs.",
    "Never invent PRs, comments, or tickets. Write Markdown with the exact section headings requested.",
  ].join(" ");

  const prompt = `Review engineer "${author}" for the period ${from || "(all time)"} to ${to || "(all time)"}.

## Coverage (pre-computed — use these counts, do not recount)
${JSON.stringify(coverage, null, 2)}
signalCounts = how often each habit tag appeared. complexity / completeness = label tallies.
Only saved structured reviews are in the packet.

## Delivery metrics (synced authored PRs — do not recompute)
${JSON.stringify(metrics, null, 2)}
Use volume as context, not as a quality proxy. Do not praise or penalize story points when they are 0 or unused.

## Saved PR reviews (${prReviews.length})
Each item: ticketComplexity, codeCompleteness, strengths, improvements, signals, summary.
${JSON.stringify(prReviews, null, 2)}

Produce a Markdown document with exactly these sections, in this order:

# Performance Review — ${author}
One line: period · N saved reviews. No numeric score.

## Executive Summary
3–5 sentences. Lead with 2–3 dominant habits from signalCounts / repeated improvements. State coverage gaps if unreviewedCount > 0. Do not invent or average a rating.

## Delivery
PR/ticket volume from metrics, with 2–4 cited PR ids. Separate “shipped a lot” from “shipped hard work”. If story points are missing, omit them.

## Habits (from saved PR reviews)
Start from signalCounts. For each recurring habit (2+ PRs, or 1× high-complexity / security-risk):
- name the habit in plain language (you may keep the signal tag in parentheses)
- cite PR ids
- quote one improvement or strength bullet
Then 3–6 bullets of recurring strengths the same way.
If high-complexity PRs have weaker completeness than low-complexity ones, say so explicitly.
If nothing repeats, say the sample is too small for habits and list one-off notes only.
Note incomplete coverage when unreviewedCount > 0.

## Rework & Bug Turnaround
From metrics.reworkEvents / avgDaysToReworkPr only. Name ticket keys. Reopen is not automatically the author’s fault — say if the packet does not show who caused it. If none, say so.

## Recommendations
2–4 numbered items. Each must map to a habit or completeness pattern above and name at least one PR id. No generic advice (“write more tests”) unless tests-missing (or equivalent improvements) actually recurred.

## Evidence Log
"PR #<id> (<repo>) · <complexity> / <completeness> — <one-line: main signal or improvement>".

Keep under 700 words excluding Evidence Log. No HR filler, no restating the ticket titles. No 1–10 scores.`;

  return { system, prompt };
}
