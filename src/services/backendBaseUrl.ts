const rawBase = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

export const API_BASE_URL = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;

export function apiPath(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`API path must start with '/': ${path}`);
  }

  return `${API_BASE_URL}${path}`;
}
