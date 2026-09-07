import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log, logError } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const JSON_PATH = path.join(DATA_DIR, "records.json");
const SQLITE_PATH = path.join(DATA_DIR, "records.db");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function recordId(repo, prId) {
  return `${repo}#${prId}`;
}

/** JSON-file backed implementation, used when better-sqlite3 is unavailable. */
function createJsonStore() {
  ensureDataDir();

  function readAll() {
    if (!fs.existsSync(JSON_PATH)) return {};
    try {
      return JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
    } catch {
      return {};
    }
  }

  function writeAll(records) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(records, null, 2), "utf-8");
  }

  return {
    kind: "json",
    upsert(record) {
      const all = readAll();
      all[recordId(record.repo, record.prId)] = record;
      writeAll(all);
      return record;
    },
    getAll() {
      return Object.values(readAll()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    get(repo, prId) {
      return readAll()[recordId(repo, prId)] || null;
    },
    getByRepo(repo) {
      return Object.values(readAll()).filter((r) => r.repo === repo);
    },
  };
}

/** better-sqlite3 backed implementation. */
function createSqliteStore(Database) {
  ensureDataDir();
  const db = new Database(SQLITE_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS pr_ticket_records (
      id TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      prId INTEGER NOT NULL,
      data TEXT NOT NULL,
      createdAt TEXT
    )
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO pr_ticket_records (id, repo, prId, data, createdAt)
    VALUES (@id, @repo, @prId, @data, @createdAt)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, createdAt = excluded.createdAt
  `);

  return {
    kind: "sqlite",
    upsert(record) {
      upsertStmt.run({
        id: recordId(record.repo, record.prId),
        repo: record.repo,
        prId: record.prId,
        data: JSON.stringify(record),
        createdAt: record.createdAt,
      });
      return record;
    },
    getAll() {
      const rows = db.prepare(`SELECT data FROM pr_ticket_records ORDER BY createdAt DESC`).all();
      return rows.map((r) => JSON.parse(r.data));
    },
    get(repo, prId) {
      const row = db.prepare(`SELECT data FROM pr_ticket_records WHERE id = ?`).get(recordId(repo, prId));
      return row ? JSON.parse(row.data) : null;
    },
    getByRepo(repo) {
      const rows = db.prepare(`SELECT data FROM pr_ticket_records WHERE repo = ?`).all(repo);
      return rows.map((r) => JSON.parse(r.data));
    },
  };
}

let storeInstance = null;

export async function getStore() {
  if (storeInstance) return storeInstance;
  try {
    const { default: Database } = await import("better-sqlite3");
    storeInstance = createSqliteStore(Database);
    log("Record store: using SQLite (better-sqlite3).");
  } catch (err) {
    logError("better-sqlite3 unavailable, falling back to JSON file storage:", err.message);
    storeInstance = createJsonStore();
  }
  return storeInstance;
}
