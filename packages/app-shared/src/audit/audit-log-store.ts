import { createClientId } from "../lib/create-client-id";

export type AuditLogEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  detail?: string;
};

const STORAGE_KEY = "ree-audit-log";
const MAX_ITEMS = 200;
export const AUDIT_LOG_CHANGED_EVENT = "ree-audit-log-changed";

function readAll(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AuditLogEntry[];
  } catch {
    return [];
  }
}

function writeAll(items: AuditLogEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  window.dispatchEvent(new Event(AUDIT_LOG_CHANGED_EVENT));
}

export function listAuditLogEntries(): AuditLogEntry[] {
  return readAll();
}

export function appendAuditLogEntry(
  input: Omit<AuditLogEntry, "id" | "at"> & { at?: string },
): AuditLogEntry {
  const entry: AuditLogEntry = {
    ...input,
    id: createClientId("audit"),
    at: input.at ?? new Date().toISOString(),
  };
  writeAll([entry, ...readAll()]);
  return entry;
}

export function clearAuditLog(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(AUDIT_LOG_CHANGED_EVENT));
}
