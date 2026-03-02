import type { Request } from "express";
import { RequestValidationError } from "./http.js";

function read(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

export function requireString(req: Request, key: string): string {
  const value = read(req, key);
  if (!value) {
    throw new RequestValidationError(`Missing required query parameter: ${key}`);
  }
  return value;
}

export function optionalString(req: Request, key: string): string | undefined {
  return read(req, key);
}

export function optionalNumber(req: Request, key: string): number | undefined {
  const value = read(req, key);
  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RequestValidationError(`Invalid numeric query parameter: ${key}`);
  }

  return parsed;
}

export function optionalBoolean(req: Request, key: string): boolean | undefined {
  const value = read(req, key);
  if (value === undefined || value === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new RequestValidationError(`Invalid boolean query parameter: ${key}`);
}
