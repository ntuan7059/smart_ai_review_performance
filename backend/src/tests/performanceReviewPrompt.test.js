import test from "node:test";
import assert from "node:assert/strict";
import { buildMemberReviewFromPrReviewsPrompt } from "../services/performanceReviewPrompt.js";

test("member review prompt asks for habits from pre-counted signals", () => {
  const { system, prompt } = buildMemberReviewFromPrReviewsPrompt(
    "Ada",
    "2026-01-01",
    "2026-01-31",
    { totalPRs: 4, storyPoints: 0 },
    [{ repo: "app", prId: 12, score: 6, signals: ["tests-missing"], improvements: ["add tests"] }],
    {
      savedReviews: 1,
      unreviewedCount: 2,
      avgScore: 6,
      signalCounts: { "tests-missing": 1 },
      scoresByComplexity: { high: { count: 0, avgScore: null }, low: { count: 1, avgScore: 6 } },
    }
  );
  assert.match(system, /2\+ PRs/);
  assert.match(system, /formula-based/);
  assert.match(prompt, /## Habits/);
  assert.match(prompt, /signalCounts/);
  assert.match(prompt, /scoresByComplexity/);
  assert.match(prompt, /computed, not judged/);
  assert.doesNotMatch(prompt, /Quality of work/);
});
