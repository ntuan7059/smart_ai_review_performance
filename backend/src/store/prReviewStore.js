import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE_PATH = path.join(DATA_DIR, "pr-reviews.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function reviewId(repo, prId) {
  return `${repo}#${prId}`;
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeAll(reviews) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(reviews, null, 2), "utf-8");
}

import { matchesAuthor } from "../lib/authorIdentity.js";

function withinRange(iso, from, to) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

export function upsertPrReview(review) {
  const all = readAll();
  const id = reviewId(review.repo, review.prId);
  const next = {
    ...review,
    id,
    reviewedAt: review.reviewedAt || new Date().toISOString(),
  };
  all[id] = next;
  writeAll(all);
  return next;
}

export function getPrReview(repo, prId) {
  return readAll()[reviewId(repo, prId)] || null;
}

export function filterPrReviews(reviews, { author, authorUsername, from, to, repo } = {}) {
  return (reviews || [])
    .filter((r) => (repo ? r.repo === repo : true))
    .filter((r) => matchesAuthor(r, author, authorUsername))
    .filter((r) => (from || to ? withinRange(r.prCreatedAt || r.createdAt, from, to) : true))
    .sort((a, b) => new Date(b.prCreatedAt || b.reviewedAt) - new Date(a.prCreatedAt || a.reviewedAt));
}

export function listPrReviews(filters = {}) {
  return filterPrReviews(Object.values(readAll()), filters);
}

/** Compact status map keyed by `repo#prId` for table badges. */
export function listPrReviewStatuses({ repo } = {}) {
  const statuses = {};
  for (const review of Object.values(readAll())) {
    if (repo && review.repo !== repo) continue;
    statuses[review.id] = {
      reviewedAt: review.reviewedAt,
      ticketComplexity: review.ticketComplexity,
      codeCompleteness: review.codeCompleteness,
    };
  }
  return statuses;
}
