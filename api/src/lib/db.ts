import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const databasePath = path.join(dataDir, "nimblerate.db");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function runSqlRaw(args: string[]) {
  ensureDataDir();
  return execFileSync("sqlite3", args, { encoding: "utf8" });
}

export function sqlQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function executeSql(sql: string) {
  runSqlRaw([databasePath, sql]);
}

export function queryJson<T>(sql: string): T[] {
  const raw = runSqlRaw(["-json", databasePath, sql]).trim();
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
  `);
}
