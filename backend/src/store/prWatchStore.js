import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE_PATH = path.join(DATA_DIR, "pr-watch.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// UTC calendar day — matches the UTC timestamps Bitbucket returns, so "today"
// lines up with the `created_on >= ...` query used to fetch new PRs.
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function itemKey(repo, prId) {
  return `${repo}#${prId}`;
}

function writeState(state) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function readState() {
  ensureDataDir();
  let state = null;
  if (fs.existsSync(FILE_PATH)) {
    try {
      state = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
    } catch {
      state = null;
    }
  }
  if (!state || state.date !== todayKey()) {
    state = { date: todayKey(), items: {} };
    writeState(state);
  }
  return state;
}

export function getWatchDate() {
  return readState().date;
}

export function getWatchItems() {
  const state = readState();
  return Object.values(state.items).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getWatchItem(repo, prId) {
  const state = readState();
  return state.items[itemKey(repo, prId)] || null;
}

/** Adds a PR to today's watch list if it isn't already there. Returns the new item, or null if it already existed. */
export function addItemIfNew(item) {
  const state = readState();
  const key = itemKey(item.repo, item.prId);
  if (state.items[key]) return null;
  state.items[key] = {
    ...item,
    status: "not_reviewed",
    reviewDocument: null,
    reviewedAt: null,
    firstSeenAt: new Date().toISOString(),
  };
  writeState(state);
  return state.items[key];
}

export function saveReview(repo, prId, document, extra = {}) {
  const state = readState();
  const key = itemKey(repo, prId);
  if (!state.items[key]) return null;
  state.items[key] = {
    ...state.items[key],
    status: "reviewed",
    reviewDocument: document,
    reviewedAt: new Date().toISOString(),
    score: extra.score ?? null,
    strengths: extra.strengths || [],
    weaknesses: extra.weaknesses || [],
    ticketComplexity: extra.ticketComplexity || null,
    codeCompleteness: extra.codeCompleteness || null,
  };
  writeState(state);
  return state.items[key];
}
