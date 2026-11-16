import type { AuditLogDto } from "@platform/api-client/audit";
import { PROPERTY_FIELDS_CATALOG } from "@platform/app-shared/app-data/property-fields-catalog";
import {
  CASE_SPECIALIST_SUB_ROLE_LABELS,
  isCaseSpecialistSubRole,
} from "@platform/app-shared/app-data/case-specialist-sub-roles";
import { ROLES } from "@platform/app-shared/app-data/constants";
import {
  PROPERTY_BOUNDARY_ROWS,
  PROPERTY_BOUNDARY_TYPE_OPTIONS,
  PROPERTY_FINISHING_STRUCTURE_OPTIONS,
  PROPERTY_FINISHING_TYPE_OPTIONS,
} from "@platform/app-shared/app-data/po-intake-boundaries";
import {
  BOUNDARIES_AVAILABILITY_OPTIONS,
  RESTRICTION_TYPE_OPTIONS,
  RESTRICTIONS_PRESENT_OPTIONS,
  identifierTypeLabel,
} from "@platform/app-shared/app-data/po-intake-identifiers";
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

/** The log's own names: fields the catalog lacks, and catalog names written for another screen. */
const CHANGE_LOG_LABELS: Record<string, string> = {
  deedNumber: "رقم الصك",
  contacts: "ضباط الاتصال",
  owners: "الملاك",
  ownershipType: "نوع الملكية",
  deedKind: "نوع الصك",
  hasRequestNumber: "يوجد رقم طلب",
  region: "المنطقة",
  planName: "اسم المخطط",
  blockNumber: "رقم البلك",
  partitionMinutesNumber: "محضر التجزئة (رقم)",
  partitionMinutesDate: "محضر التجزئة (تاريخ)",
  restrictionType: "نوع القيد",
  restrictionOtherReason: "سبب القيد",
  inspectedPropertyType: "نوع العقار (المعاين)",
  inspectedUsage: "الاستخدام",
  finishingType: "نوع التشطيب",
  finishingStructure: "الهيكل الإنشائي",
  specialistReportExtrasJson: "إضافات الأخصائي للتقرير",
  ...Object.fromEntries(
    PROPERTY_BOUNDARY_ROWS.flatMap((row) => [
      [row.lenKey, `طول ${row.label}`],
      [row.typeKey, `نوع الحد — ${row.label}`],
      [row.facadeKey, `نوع الواجهة — ${row.label}`],
    ]),
  ),
};

/**
 * Fields the log never prints: ids whose name changes on the same save (المنطقة، المدينة، المحكمة،
 * الدائرة), and the «مشاع» tick, which «نوع الملكية» already shows.
 */
const HIDDEN_CHANGE_KEYS = new Set(["regionId", "cityId", "courtId", "circuitId", "isSharedOwnership"]);

function optionLabels(options: readonly { value: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(options.filter((o) => o.value).map((o) => [o.value, o.label]));
}

const BOUNDARY_TYPE_LABELS = optionLabels(PROPERTY_BOUNDARY_TYPE_OPTIONS);

/** Stored codes → the words the screens show, per field. */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  ownershipType: { absolute: "ملكية مطلقة", shared: "مشاع" },
  deedKind: { traditional: "صك تقليدي", registered_title: "سجل عيني" },
  identifierType: {
    deed: identifierTypeLabel("deed"),
    real_estate_reg: identifierTypeLabel("real_estate_reg"),
    bourse_inquiry: identifierTypeLabel("bourse_inquiry"),
  },
  restrictionsPresent: optionLabels(RESTRICTIONS_PRESENT_OPTIONS),
  restrictionType: optionLabels(RESTRICTION_TYPE_OPTIONS),
  boundariesAvailability: optionLabels(BOUNDARIES_AVAILABILITY_OPTIONS),
  finishingType: optionLabels(PROPERTY_FINISHING_TYPE_OPTIONS),
  finishingStructure: optionLabels(PROPERTY_FINISHING_STRUCTURE_OPTIONS),
  ...Object.fromEntries(PROPERTY_BOUNDARY_ROWS.map((row) => [row.typeKey, BOUNDARY_TYPE_LABELS])),
};

/** Arabic label of a property field (the log's own names, then the fields catalog), else the wire key itself. */
export function propertyFieldLabel(key: string): string {
  return CHANGE_LOG_LABELS[key] ?? LABEL_BY_KEY.get(key) ?? key;
}

/** The changed fields a reader sees — the ids and the duplicate «مشاع» tick left out. */
export function visiblePropertyChangeKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => !HIDDEN_CHANGE_KEYS.has(key));
}

/**
 * One value as the screens word it.
 *
 * How it works: a stored code is looked up in its field's options (restriction types are a comma
 * list, each looked up); booleans read نعم / لا; a JSON text (the specialist's report extras) and an
 * object read «قيمة مركّبة»; lists read as an item count.
 * Edge cases: empty → «—»; a code missing from the options prints as stored (free Arabic text such
 * as facades and usages is already readable).
 */
function printable(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return "—";
    if (text.startsWith("{") || text.startsWith("[")) return "قيمة مركّبة";
    const labels = VALUE_LABELS[key];
    if (!labels) return text;
    return text
      .split(",")
      .map((part) => labels[part.trim()] ?? part.trim())
      .join("، ");
  }
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
    const keys = visiblePropertyChangeKeys(Object.keys(fields));
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
          before: printable(key, before[key]),
          after: printable(key, fields[key]),
        })),
      },
    ];
  });
}

/** Circles on one line of the «سجل تعديلات البيانات» chain (Omar 2026-11-15: five, then a new line). */
export const CHANGE_CHAIN_PER_ROW = 5;

/**
 * Lays the change log out as the chain the window draws: oldest save first, cut into lines.
 *
 * How it works: the API answers newest first, so the list is reversed, then sliced every `perRow`
 * entries. Edge cases: no entries → no lines; the last line holds what is left (1 to `perRow`).
 */
export function propertyChangeChainRows(
  entries: readonly PropertyChangeEntry[],
  perRow = CHANGE_CHAIN_PER_ROW,
): PropertyChangeEntry[][] {
  const oldestFirst = [...entries].reverse();
  const rows: PropertyChangeEntry[][] = [];
  for (let i = 0; i < oldestFirst.length; i += perRow) rows.push(oldestFirst.slice(i, i + perRow));
  return rows;
}
