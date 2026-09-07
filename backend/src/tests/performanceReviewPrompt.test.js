import test from "node:test";
import assert from "node:assert/strict";
import { buildMemberReviewFromPrReviewsPrompt } from "../services/performanceReviewPrompt.js";

test("member review prompt asks for habits from pre-counted signals", () => {
  const { system, prompt } = buildMemberReviewFromPrReviewsPrompt(
    "Ada",
    "2026-01-01",
    "2026-01-31",
    { totalPRs: 4, storyPoints: 0 },
    [{ repo: "app", prId: 12, signals: ["tests-missing"], improvements: ["add tests"] }],
    {
      savedReviews: 1,
      unreviewedCount: 2,
      signalCounts: { "tests-missing": 1 },
      complexity: { low: 1 },
      completeness: { adequate: 1 },
    }
  );
  assert.match(system, /2\+ PRs/);
  assert.match(system, /Do not assign numeric scores/);
  assert.match(prompt, /## Habits/);
  assert.match(prompt, /signalCounts/);
  assert.match(prompt, /unreviewedCount/);
  assert.doesNotMatch(prompt, /## Scores/);
  assert.doesNotMatch(prompt, /avg score/);
  assert.doesNotMatch(prompt, /Quality of work/);
});
