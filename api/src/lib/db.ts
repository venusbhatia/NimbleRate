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

function ensureColumn(table: string, column: string, definition: string) {
  const columns = queryJson<{ name: string }>(`PRAGMA table_info(${table});`);
  const hasColumn = columns.some((entry) => entry.name === column);

  if (!hasColumn) {
    executeSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
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

    CREATE TABLE IF NOT EXISTS analysis_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_run_id INTEGER NOT NULL,
      property_id TEXT NOT NULL DEFAULT 'default',
      market_key TEXT NOT NULL,
      analysis_date TEXT NOT NULL,
      recommended_rate REAL NOT NULL,
      anchor_rate REAL NOT NULL,
      occupancy_rate REAL NOT NULL,
      final_multiplier REAL NOT NULL,
      raw_multiplier REAL NOT NULL,
      event_impact REAL NOT NULL DEFAULT 0,
      weather_category TEXT NOT NULL DEFAULT 'cloudy',
      created_at TEXT NOT NULL,
      FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id)
    );

    CREATE TABLE IF NOT EXISTS rate_push_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id TEXT NOT NULL DEFAULT 'default',
      market_key TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      idempotency_key TEXT,
      requested_by TEXT NOT NULL DEFAULT 'operator',
      requested_at TEXT NOT NULL,
      approved_at TEXT,
      completed_at TEXT,
      rollback_job_id INTEGER,
      notes TEXT,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_push_job_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      rate_date TEXT NOT NULL,
      target_rate REAL NOT NULL,
      previous_rate REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL,
      external_reference TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES rate_push_jobs(id)
    );

    CREATE TABLE IF NOT EXISTS properties (
      property_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country_code TEXT NOT NULL,
      city_name TEXT NOT NULL,
      lat REAL,
      lon REAL,
      hotel_type TEXT NOT NULL DEFAULT 'city',
      total_rooms INTEGER NOT NULL DEFAULT 40,
      channel_provider TEXT NOT NULL DEFAULT 'simulated',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_runs_market_requested
      ON analysis_runs(market_key, requested_at);

    CREATE INDEX IF NOT EXISTS idx_compset_city_collected_dates
      ON compset_snapshots(city, collected_at, check_in, check_out);

    CREATE INDEX IF NOT EXISTS idx_analysis_daily_property_market_date
      ON analysis_daily(property_id, market_key, analysis_date);

    CREATE INDEX IF NOT EXISTS idx_analysis_daily_created_at
      ON analysis_daily(created_at);

    CREATE INDEX IF NOT EXISTS idx_rate_push_jobs_property_requested
      ON rate_push_jobs(property_id, requested_at);

    CREATE INDEX IF NOT EXISTS idx_rate_push_items_job
      ON rate_push_job_items(job_id);

    CREATE INDEX IF NOT EXISTS idx_properties_city_country
      ON properties(city_name, country_code);
  `);

  ensureColumn("compset_snapshots", "property_id", "TEXT NOT NULL DEFAULT 'default'");
  ensureColumn("analysis_runs", "property_id", "TEXT NOT NULL DEFAULT 'default'");
  ensureColumn("rate_push_jobs", "idempotency_key", "TEXT");
  ensureColumn("rate_push_job_items", "external_reference", "TEXT");
  ensureColumn("rate_push_job_items", "attempt_count", "INTEGER NOT NULL DEFAULT 1");

  executeSql(`
    CREATE INDEX IF NOT EXISTS idx_analysis_runs_property_market_requested
      ON analysis_runs(property_id, market_key, requested_at);

    CREATE INDEX IF NOT EXISTS idx_compset_property_city_collected_dates
      ON compset_snapshots(property_id, city, collected_at, check_in, check_out);

    CREATE INDEX IF NOT EXISTS idx_rate_push_jobs_property_mode_idempotency
      ON rate_push_jobs(property_id, mode, idempotency_key);
  `);

  const nowIso = new Date().toISOString();
  executeSql(`
    INSERT INTO properties(
      property_id, name, country_code, city_name, lat, lon, hotel_type, total_rooms, channel_provider, created_at, updated_at
    )
    VALUES (
      'default', 'Default Property', 'US', 'Austin', 30.2672, -97.7431, 'city', 40, 'simulated', ${sqlQuote(nowIso)}, ${sqlQuote(nowIso)}
    )
    ON CONFLICT(property_id) DO NOTHING;
  `);
}
