import test from "node:test";
import assert from "node:assert/strict";
import { parseAiJson } from "../lib/parseAiJson.js";
import { normalizeAssessment, averageScore, formatPrReviewMarkdown } from "../lib/prReviewSchema.js";
import { filterPrReviews } from "../store/prReviewStore.js";
import { matchesAuthor } from "../lib/authorIdentity.js";

test("parseAiJson reads a fenced JSON object", () => {
  const raw = 'Sure.\n```json\n{"score": 8, "summary": "ok"}\n```\n';
  assert.deepEqual(parseAiJson(raw), { score: 8, summary: "ok" });
});

test("parseAiJson reads a bare object surrounded by prose", () => {
  const raw = 'Here you go:\n{"strengths": ["tests"], "score": 7}\nThanks.';
  assert.deepEqual(parseAiJson(raw), { strengths: ["tests"], score: 7 });
});

test("parseAiJson returns null on garbage", () => {
  assert.equal(parseAiJson("not json"), null);
  assert.equal(parseAiJson(""), null);
});

test("normalizeAssessment clamps score and enums", () => {
  const out = normalizeAssessment({
    strengths: ["clear structure", ""],
    weaknesses: ["missing tests"],
    score: 14,
    scoreRationale: "hard ticket, solid code",
    ticketComplexity: "HIGH",
    codeCompleteness: "nope",
    summary: "Shipped the login flow.",
  });
  assert.equal(out.score, 10);
  assert.deepEqual(out.strengths, ["clear structure"]);
  assert.equal(out.ticketComplexity, "high");
  assert.equal(out.codeCompleteness, "adequate");
});

test("normalizeAssessment shortens verbose review text", () => {
  const out = normalizeAssessment({
    strengths: ["a", "b", "c", "d"],
    weaknesses: ["x".repeat(200)],
    summary: "First. ".repeat(40),
    scoreRationale: "Because. ".repeat(30),
    score: 7,
  });
  assert.equal(out.strengths.length, 3);
  assert.ok(out.weaknesses[0].endsWith("…"));
  assert.ok(out.summary.length <= 221);
  assert.ok(out.scoreRationale.length <= 161);
});

test("averageScore ignores missing scores", () => {
  assert.equal(averageScore([{ score: 8 }, { score: 6 }, { score: null }]), 7);
  assert.equal(averageScore([]), null);
});

test("formatPrReviewMarkdown includes score and lists", () => {
  const md = formatPrReviewMarkdown({
    prId: 12,
    title: "Add login",
    author: "Ada",
    repo: "app",
    state: "MERGED",
    jiraKey: "PROJ-1",
    storyPoints: 3,
    score: 8,
    scoreRationale: "Matches ticket.",
    ticketComplexity: "medium",
    codeCompleteness: "solid",
    summary: "Login works.",
    strengths: ["tests"],
    weaknesses: ["no rate limit"],
  });
  assert.match(md, /# PR Review — #12 Add login/);
  assert.match(md, /## Score: 8\/10/);
  assert.match(md, /PROJ-1 \(3 pts\)/);
  assert.match(md, /- tests/);
});

test("filterPrReviews matches author and date range", () => {
  const reviews = [
    { repo: "a", author: "Ada", authorUsername: "ada", prCreatedAt: "2026-01-10T00:00:00.000Z" },
    { repo: "a", author: "Bob", authorUsername: "bob", prCreatedAt: "2026-01-20T00:00:00.000Z" },
    { repo: "b", author: "Ada", authorUsername: "ada", prCreatedAt: "2026-02-01T00:00:00.000Z" },
  ];
  const adaJan = filterPrReviews(reviews, { author: "ada", from: "2026-01-01", to: "2026-01-31" });
  assert.equal(adaJan.length, 1);
  assert.equal(adaJan[0].prCreatedAt, "2026-01-10T00:00:00.000Z");
});

test("matchesAuthor treats display name and Bitbucket nickname as the same person", () => {
  const record = { author: "Lia Tran", authorUsername: "Trần Khánh Ngân" };
  assert.equal(matchesAuthor(record, "Lia Tran", null), true);
  assert.equal(matchesAuthor(record, "Trần Khánh Ngân", null), true);
  assert.equal(matchesAuthor(record, "Lia Tran", "Trần Khánh Ngân"), true);
  assert.equal(matchesAuthor(record, "Someone Else", "other"), false);
});
