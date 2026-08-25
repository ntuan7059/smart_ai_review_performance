import test from "node:test";
import assert from "node:assert/strict";
import { extractJiraKey, extractJiraKeyFromText } from "../lib/extractJiraKey.js";

test("finds key in branch name: feature/PROJ-123-add-login", () => {
  const result = extractJiraKey("feature/PROJ-123-add-login", "Add login flow");
  assert.equal(result.key, "PROJ-123");
  assert.equal(result.source, "branch");
  assert.equal(result.multiple, false);
});

test("finds key in title when branch has none: PROJ-123: Fix bug", () => {
  const result = extractJiraKey("hotfix/generic-branch", "PROJ-123: Fix bug");
  assert.equal(result.key, "PROJ-123");
  assert.equal(result.source, "title");
});

test("no ticket found: hotfix/no-ticket-here", () => {
  const result = extractJiraKey("hotfix/no-ticket-here", "General cleanup");
  assert.equal(result.key, null);
  assert.equal(result.allKeys.length, 0);
  assert.equal(result.source, null);
});

test("multiple keys in combo branch: PROJ-1-PROJ-2-combo-branch", () => {
  const result = extractJiraKey("PROJ-1-PROJ-2-combo-branch", "Combo change");
  assert.equal(result.key, "PROJ-1");
  assert.equal(result.multiple, true);
  assert.deepEqual(result.allKeys, ["PROJ-1", "PROJ-2"]);
});

test("normalizes lowercase keys to uppercase", () => {
  const result = extractJiraKey("feature/proj-42-lowercase", null);
  assert.equal(result.key, "PROJ-42");
});

test("prefers branch match over title match when both present", () => {
  const result = extractJiraKey("feature/PROJ-1-branch", "PROJ-2: title key");
  assert.equal(result.key, "PROJ-1");
  assert.equal(result.source, "branch");
});

test("extractJiraKeyFromText convenience wrapper returns first key or null", () => {
  assert.equal(extractJiraKeyFromText("feature/PROJ-9-thing"), "PROJ-9");
  assert.equal(extractJiraKeyFromText("no key here"), null);
});
