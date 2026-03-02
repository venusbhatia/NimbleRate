import path from "node:path";
import { describe, expect, it } from "vitest";
import { isDatabaseLockedError, resolveDatabasePath } from "./db.js";

describe("db helpers", () => {
  it("resolves default database path when env is missing", () => {
    const resolved = resolveDatabasePath(undefined, "/tmp/demo");
    expect(resolved).toBe(path.resolve("/tmp/demo", "data", "nimblerate.db"));
  });

  it("resolves relative override path against cwd", () => {
    const resolved = resolveDatabasePath("custom/db.sqlite", "/tmp/demo");
    expect(resolved).toBe(path.resolve("/tmp/demo", "custom/db.sqlite"));
  });

  it("detects sqlite lock errors", () => {
    expect(isDatabaseLockedError(new Error("database is locked (5)"))).toBe(true);
    expect(isDatabaseLockedError(new Error("database table is locked"))).toBe(true);
    expect(isDatabaseLockedError(new Error("some other sqlite error"))).toBe(false);
  });
});
