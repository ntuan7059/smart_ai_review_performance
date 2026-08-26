import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listAuthors } from "../services/performanceReviewService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE_PATH = path.join(DATA_DIR, "author-emails.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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

function writeAll(mappings) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(mappings, null, 2), "utf-8");
}

export function authorKey(author, authorUsername) {
  return (authorUsername || author || "").trim().toLowerCase();
}

export function resolveEmail(author, authorUsername) {
  const key = authorKey(author, authorUsername);
  if (!key) return null;
  const mappings = readAll();
  return mappings[key] || null;
}

export function setMapping(key, email) {
  const mappings = readAll();
  const normalizedKey = key.trim().toLowerCase();
  if (email) {
    mappings[normalizedKey] = email.trim();
  } else {
    delete mappings[normalizedKey];
  }
  writeAll(mappings);
  return mappings;
}

/** Every known author (from synced PR records), joined with any email already mapped. */
export async function listMappings() {
  const authors = await listAuthors();
  const mappings = readAll();
  return authors.map(({ author, authorUsername }) => {
    const key = authorKey(author, authorUsername);
    return { key, author, authorUsername, email: mappings[key] || null };
  });
}
