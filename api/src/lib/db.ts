import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DB_BUSY_TIMEOUT_MS = 5000;
const LOCK_RETRY_ATTEMPTS = 4;

export function resolveDatabasePath(rawPath = process.env.NIMBLERATE_DB_PATH, cwd = process.cwd()) {
  if (!rawPath || rawPath.trim().length === 0) {
    return path.resolve(cwd, "data", "nimblerate.db");
  }

  const normalized = rawPath.trim();
  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  return path.resolve(cwd, normalized);
}

export function isDatabaseLockedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("database is locked") || message.includes("database table is locked");
}

function sleep(ms: number) {
  const waitBuffer = new SharedArrayBuffer(4);
  const waitArray = new Int32Array(waitBuffer);
  Atomics.wait(waitArray, 0, 0, ms);
}

const databasePath = resolveDatabasePath();
const dataDir = path.dirname(databasePath);

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function runSqlRaw(args: string[]) {
  ensureDataDir();

  for (let attempt = 0; attempt < LOCK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return execFileSync("sqlite3", args, { encoding: "utf8" });
    } catch (error) {
      if (!isDatabaseLockedError(error) || attempt === LOCK_RETRY_ATTEMPTS - 1) {
        throw error;
      }

      sleep(50 * (attempt + 1));
    }
  }

  return "";
}

export function sqlQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function executeSql(sql: string) {
  runSqlRaw(["-cmd", `.timeout ${DB_BUSY_TIMEOUT_MS}`, databasePath, sql]);
}

export function queryJson<T>(sql: string): T[] {
  const raw = runSqlRaw(["-cmd", `.timeout ${DB_BUSY_TIMEOUT_MS}`, "-json", databasePath, sql]).trim();
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function getDatabasePath() {
  return databasePath;
}

export function initDatabase() {
  executeSql(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS provider_usage (
      provider TEXT NOT NULL,
      day TEXT NOT NULL,
      calls INTEGER NOT NULL DEFAULT 0,
      quota INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (provider, day)
    );

    CREATE TABLE IF NOT EXISTS compset_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      hotel_name TEXT NOT NULL,
      hotel_id TEXT NOT NULL,
      rate REAL NOT NULL,
      ota TEXT NOT NULL,
      collected_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_key TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      confidence TEXT NOT NULL,
      anchor_rate REAL NOT NULL,
      recommended_rate REAL NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_runs_market_requested
      ON analysis_runs(market_key, requested_at);

    CREATE INDEX IF NOT EXISTS idx_compset_city_collected_dates
      ON compset_snapshots(city, collected_at, check_in, check_out);
  `);
}
