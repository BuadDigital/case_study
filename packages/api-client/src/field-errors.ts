function toCamelCaseKey(key: string): string {
  if (!key) return key;
  return key.charAt(0).toLowerCase() + key.slice(1);
}

export function normalizeFieldErrors(
  raw?: Record<string, string | string[]>,
): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = toCamelCaseKey(key);
    if (typeof value === "string" && value.trim()) {
      out[normalizedKey] = value;
      continue;
    }
    if (Array.isArray(value)) {
      const first = value.find((v) => typeof v === "string" && v.trim());
      if (first) out[normalizedKey] = first;
    }
  }
  return out;
}

export async function parseFieldErrorsFromResponse(
  res: Response,
): Promise<Record<string, string>> {
  try {
    const body = (await res.json()) as {
      errors?: Record<string, string | string[]>;
      detail?: string;
      message?: string;
    };
    const normalized = normalizeFieldErrors(body.errors);
    if (!normalized._) {
      const detail = body.detail?.trim() || body.message?.trim();
      if (detail) normalized._ = detail;
    }
    return normalized;
  } catch {
    return {};
  }
}
