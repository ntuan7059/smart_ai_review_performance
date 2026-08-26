import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE_PATH = path.join(DATA_DIR, "usage-events.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function writeAll(events) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(events, null, 2), "utf-8");
}

/** Appends a usage event ({type, author, authorUsername, authorEmail, repo, prId, meta}). */
export function appendEvent(event) {
  const events = readAll();
  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };
  events.push(record);
  writeAll(events);
  return record;
}

export function getAllEvents() {
  return readAll();
}
