// Thin fetch wrapper shared by every query/mutation hook in this folder. All
// settings UI data access goes through here so it can be audited in one place.

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | null;

  public constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorBody = {
  error?: string;
  message?: string;
  issues?: { path: string; message: string }[];
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const hasBody = init?.body !== undefined;
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error body; fall back to status text.
    }
    // Most routes in this codebase put their human-readable text in `error`
    // (it doubles as the machine code below) rather than `message` — only a
    // minority set both. `message` and the first validation issue still win
    // when present; `error` is the fallback ahead of the generic status
    // text, not the other way around, or most server errors would render as
    // "Bad Request" (or blank — HTTP/2 responses often carry no status text
    // at all, which is what surfaced this: a real server message reaching
    // the client as an empty string).
    throw new ApiError(
      body.message ?? body.issues?.[0]?.message ?? body.error ?? response.statusText,
      response.status,
      body.error ?? null,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
