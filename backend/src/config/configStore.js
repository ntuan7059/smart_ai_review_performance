import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

const DEFAULTS = {
  atlassianEmail: process.env.ATLASSIAN_EMAIL || "",
  atlassianApiToken: process.env.ATLASSIAN_API_TOKEN || "",
  jiraBaseUrl: process.env.JIRA_BASE_URL || "",
  jiraStoryPointsField: process.env.JIRA_STORY_POINTS_FIELD || "customfield_10016",
  bitbucketWorkspace: process.env.BITBUCKET_WORKSPACE || "",
  bitbucketApiToken: process.env.BITBUCKET_API_TOKEN || "",
  aiProvider: process.env.AI_PROVIDER || "",
  aiApiKey: process.env.AI_API_KEY || "",
  aiModel: process.env.AI_MODEL || "",
  // Claude only: authenticate via an `ant auth login` OAuth profile on this machine
  // (the same credential Claude Code uses) instead of a metered API key, so a
  // Claude Pro/Max seat can power reviews without separate API billing.
  aiUseClaudeSubscription: process.env.AI_USE_CLAUDE_SUBSCRIPTION === "true",
  // Parent directory of local git clones for AI Review (required for code diff analysis).
  // Diffs are read via `git show` on this machine only — never from Bitbucket API.
  localRepoRoot: process.env.LOCAL_REPO_ROOT || "",
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ...DEFAULTS };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeConfig(partial) {
  ensureDataDir();
  const current = readConfig();
  const next = { ...current, ...partial };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

/** Config with secrets stripped, safe to send to the frontend. */
export function redactedConfig() {
  const cfg = readConfig();
  return {
    atlassianEmail: cfg.atlassianEmail,
    atlassianApiTokenSet: Boolean(cfg.atlassianApiToken),
    jiraBaseUrl: cfg.jiraBaseUrl,
    jiraStoryPointsField: cfg.jiraStoryPointsField,
    bitbucketWorkspace: cfg.bitbucketWorkspace,
    bitbucketApiTokenSet: Boolean(cfg.bitbucketApiToken),
    aiProvider: cfg.aiProvider,
    aiModel: cfg.aiModel,
    aiApiKeySet: Boolean(cfg.aiApiKey),
    aiUseClaudeSubscription: Boolean(cfg.aiUseClaudeSubscription),
    localRepoRoot: cfg.localRepoRoot || "",
  };
}
