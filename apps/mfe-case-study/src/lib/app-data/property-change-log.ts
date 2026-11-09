import type { AuditLogDto } from "@platform/api-client/audit";
import { PROPERTY_FIELDS_CATALOG } from "@platform/app-shared/app-data/property-fields-catalog";
import {
  CASE_SPECIALIST_SUB_ROLE_LABELS,
  isCaseSpecialistSubRole,
} from "@platform/app-shared/app-data/case-specialist-sub-roles";
import { ROLES } from "@platform/app-shared/app-data/constants";
import type { RoleId } from "@platform/types";

/** One changed field of one save, ready to print. */
export type PropertyChangeLine = { field: string; label: string; before: string; after: string };

/** One save of the property's data with every field it changed. */
export type PropertyChangeEntry = {
  id: string;
  atUtc: string;
  actorName: string;
  /** «أخصائي دراسة حالة (دراسة العقار)», «مقيّم عقاري»… — who edited, in which capacity. */
  actorCapacity: string;
  autosave: boolean;
  lines: PropertyChangeLine[];
};

const LABEL_BY_KEY = new Map<string, string>(
  PROPERTY_FIELDS_CATALOG.flatMap((group) => group.fields).map((f) => [f.key, f.label]),
);

/** Arabic label of a property field (the fields catalog), else the wire key itself. */
export function propertyFieldLabel(key: string): string {
  return LABEL_BY_KEY.get(key) ?? key;
}

function printable(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "—" : `${value.length} عنصر`;
  return "قيمة مركّبة";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Turns the audit rows of `listPropertyChangeLog` into printable entries.
 *
 * How it works: `before` maps field → old value; `after.fields` maps field → new value, beside the
 * actor's name, role and sub-roles. Lists (owners, contacts) print as an item count, objects as
 * «قيمة مركّبة». Edge cases: rows of another shape are skipped; an unknown role prints as given;
 * sub-roles print only for a case specialist.
 */
export function toPropertyChangeEntries(items: readonly AuditLogDto[]): PropertyChangeEntry[] {
  return items.flatMap((item) => {
    const before = record(item.before);
    const after = record(item.after);
    const fields = record(after.fields);
    const keys = Object.keys(fields);
    if (keys.length === 0) return [];
    const role = typeof after.actorRole === "string" ? after.actorRole : "";
    const roleLabel = ROLES[role as RoleId]?.dept ?? role;
    const subRoles = Array.isArray(after.actorSubRoles)
      ? after.actorSubRoles.filter((s): s is string => typeof s === "string").filter(isCaseSpecialistSubRole)
      : [];
    const capacity =
      role === "case-specialist" && subRoles.length > 0 && subRoles.length < 3
        ? `${roleLabel} (${subRoles.map((s) => CASE_SPECIALIST_SUB_ROLE_LABELS[s]).join("، ")})`
        : roleLabel;
    return [
      {
        id: item.id,
        atUtc: item.createdAtUtc,
        actorName:
          (typeof after.actorName === "string" && after.actorName.trim()) ||
          item.actorDisplayName?.trim() ||
          "—",
        actorCapacity: capacity,
        autosave: after.autosave === true,
        lines: keys.map((key) => ({
          field: key,
          label: propertyFieldLabel(key),
          before: printable(before[key]),
          after: printable(fields[key]),
        })),
      },
    ];
  });
}
