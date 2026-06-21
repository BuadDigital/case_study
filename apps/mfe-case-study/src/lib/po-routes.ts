/** Routes under أوامر العمل — PO number is URL-encoded in paths. */

/** ASCII segment — Next.js on Windows does not reliably serve Arabic path folders. */
export const PO_PROPERTY_SEGMENT = "property";

export function poListPath(): string {
  return "/po";
}

export function poHeaderEditPath(poNumber: string): string {
  return `/po/${encodeURIComponent(poNumber.trim())}/edit`;
}

export function poPropertiesPath(poNumber: string): string {
  return `/po/${encodeURIComponent(poNumber.trim())}/${PO_PROPERTY_SEGMENT}`;
}

export function poPropertyNewPath(poNumber: string): string {
  return `${poPropertiesPath(poNumber)}/new`;
}

export function poPropertyPath(poNumber: string, propertyId: string): string {
  return `${poPropertiesPath(poNumber)}/${encodeURIComponent(propertyId)}`;
}

export function poPropertyDetailPath(
  poNumber: string,
  propertyId: string,
  tab?: string,
): string {
  const base = poPropertyPath(poNumber, propertyId);
  const t = tab?.trim();
  if (!t) return base;
  return `${base}?tab=${encodeURIComponent(t)}`;
}

export function poPropertyEditPath(poNumber: string, propertyId: string): string {
  return `${poPropertyPath(poNumber, propertyId)}/edit`;
}

export function poPropertyFailurePath(poNumber: string, propertyId: string): string {
  return `${poPropertyPath(poNumber, propertyId)}/failure`;
}

export function decodePoParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
