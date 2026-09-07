import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertValidCommitHash, resolveLocalRepoPath } from "../lib/localGit.js";

describe("localGit", () => {
  describe("resolveLocalRepoPath", () => {
    it("finds repo at {root}/{slug}", () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "git-root-"));
      const repo = path.join(root, "my-app");
      fs.mkdirSync(repo);
      fs.mkdirSync(path.join(repo, ".git"));
      assert.equal(resolveLocalRepoPath(root, "my-app", "acme"), repo);
      fs.rmSync(root, { recursive: true, force: true });
    });

    it("finds repo at {root}/{workspace}/{slug}", () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "git-root-"));
      const repo = path.join(root, "acme", "my-app");
      fs.mkdirSync(repo, { recursive: true });
      fs.mkdirSync(path.join(repo, ".git"));
      assert.equal(resolveLocalRepoPath(root, "my-app", "acme"), repo);
      fs.rmSync(root, { recursive: true, force: true });
    });

    it("returns null when no clone exists", () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "git-root-"));
      assert.equal(resolveLocalRepoPath(root, "missing", "acme"), null);
      fs.rmSync(root, { recursive: true, force: true });
    });
  });

  describe("assertValidCommitHash", () => {
    it("accepts a full sha", () => {
      assertValidCommitHash("abc123def4567890abc123def4567890abc123de");
    });

    it("rejects invalid hashes", () => {
      assert.throws(() => assertValidCommitHash("not-a-hash"), /Invalid commit hash/);
    });
  });
});
