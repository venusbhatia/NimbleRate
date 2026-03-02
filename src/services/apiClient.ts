export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

function toQueryString(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

export async function apiFetch<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, body, ...rest } = options;
  const queryUrl = `${url}${toQueryString(params)}`;

  const response = await fetch(queryUrl, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let parsed: unknown;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    parsed = await response.json();
  } else {
    parsed = await response.text();
  }

  if (!response.ok) {
    throw new ApiError(`Request failed: ${response.status}`, response.status, parsed);
  }

  return parsed as T;
}
