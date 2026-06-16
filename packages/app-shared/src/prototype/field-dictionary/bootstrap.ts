import type { RoleId } from "@platform/types";
import { PROPERTY_FIELDS_CATALOG } from "../property-fields-catalog";
import { CATALOG_SOURCE_ROLE_PRIMARY } from "./screens";
import type {
  FieldAssignmentMode,
  FieldDictionaryAssignment,
  FieldDictionaryField,
  FieldDictionaryFieldType,
} from "./types";

function inferFieldType(
  key: string,
  label: string,
): FieldDictionaryFieldType {
  const haystack = `${key} ${label}`.toLowerCase();
  if (/(^has|^is)[A-Z]/.test(key) || haystack.includes("هل ")) return "bool";
  if (key.includes("Date") || label.includes("تاريخ")) return "date";
  if (key.includes("Phone") || label.includes("جوال") || label.includes("هاتف"))
    return "phone";
  if (key.includes("email") || label.includes("بريد")) return "email";
  if (key.includes("FileName") || label.includes("مرفق") || label.includes("مستند"))
    return "file";
  if (
    key.includes("Area") ||
    key.includes("Sqm") ||
    label.includes("مساحة") ||
    label.includes("(م²)")
  )
    return "decimal";
  if (key.includes("Price") || key.includes("fees") || label.includes("أتعاب"))
    return "currency";
  if (key.includes("Percent") || label.includes("نسبة")) return "percent";
  if (key.includes("Coords") || label.includes("إحداثيات")) return "geo";
  if (key.includes("Photo") || label.includes("صورة")) return "image";
  if (label.includes("قائمة") || key.includes("Status") || key.includes("Type"))
    return "list";
  if (label.includes("ملاحظات") || label.includes("وصف")) return "textarea";
  return "text";
}

function inferTags(groupId: string, key: string): string[] {
  const tags: string[] = [];
  if (groupId.includes("infath") || groupId.includes("enfath")) tags.push("إنفاذ");
  if (
    groupId.includes("financial") ||
    key.includes("Price") ||
    key.includes("fees")
  )
    tags.push("مالي");
  if (
    groupId.includes("engineering") ||
    groupId.includes("survey") ||
    key.includes("boundary")
  )
    tags.push("هندسي");
  if (groupId.includes("government") || groupId.includes("workflow"))
    tags.push("إداري");
  if (
    ["city", "district", "deedNumber", "ownerName", "propertyType"].includes(
      key,
    )
  )
    tags.push("مشترك");
  return tags;
}

function assignmentModeForGroup(
  groupId: string,
  screenLabel: string,
): FieldAssignmentMode {
  if (groupId.includes("display") || screenLabel.includes("عرض")) return "view";
  return "input";
}

function primaryRoleForGroup(sourceRole: string): RoleId {
  return (CATALOG_SOURCE_ROLE_PRIMARY[sourceRole] ??
    "case-specialist") as RoleId;
}

function upsertAssignment(
  assignments: FieldDictionaryAssignment[],
  next: FieldDictionaryAssignment,
): FieldDictionaryAssignment[] {
  const existing = assignments.find(
    (assignment) =>
      assignment.role === next.role && assignment.mode === next.mode,
  );
  if (!existing) return [...assignments, next];
  return assignments.map((assignment) => {
    if (assignment !== existing) return assignment;
    const screens = [...assignment.screens];
    next.screens.forEach((screenId) => {
      if (!screens.includes(screenId)) screens.push(screenId);
    });
    return {
      ...assignment,
      screens,
      required: assignment.required || next.required,
      final: assignment.final || next.final,
    };
  });
}

function applyKnownReliabilityRules(
  fields: FieldDictionaryField[],
): FieldDictionaryField[] {
  const propertyType = fields.find((field) => field.key === "propertyType");
  if (!propertyType) return fields;

  const patch: Partial<Record<RoleId, Partial<FieldDictionaryAssignment>>> = {
    "field-inspector": { final: true, mode: "input", required: true },
    "government-reviewer": { mode: "input" },
    "case-specialist": { mode: "input" },
    "financial-officer": { mode: "view" },
  };

  let assignments = [...propertyType.assignments];
  (Object.keys(patch) as RoleId[]).forEach((roleId) => {
    const meta = patch[roleId];
    if (!meta) return;
    const existing = assignments.find((assignment) => assignment.role === roleId);
    if (existing) {
      assignments = assignments.map((assignment) =>
        assignment.role === roleId ? { ...assignment, ...meta } : assignment,
      );
    } else {
      assignments.push({
        role: roleId,
        screens: ["inspector-core"],
        mode: meta.mode ?? "input",
        required: meta.required,
        final: meta.final,
      });
    }
  });

  return fields.map((field) =>
    field.key === "propertyType" ? { ...field, assignments } : field,
  );
}

/** يبني القاموس من `property-fields-catalog` — مصدر حقول النظام الحالي. */
export function bootstrapFieldDictionary(): FieldDictionaryField[] {
  const fieldMap = new Map<string, FieldDictionaryField>();
  let refCounter = 0;

  for (const group of PROPERTY_FIELDS_CATALOG) {
    const role = primaryRoleForGroup(group.sourceRole);
    const mode = assignmentModeForGroup(group.id, group.screen);

    for (const entry of group.fields) {
      let field = fieldMap.get(entry.key);
      if (!field) {
        refCounter += 1;
        field = {
          id: entry.key,
          ref: `FLD-${String(refCounter).padStart(3, "0")}`,
          key: entry.key,
          name: entry.label,
          type: inferFieldType(entry.key, entry.label),
          tags: inferTags(group.id, entry.key),
          persisted: true,
          assignments: [],
        };
        fieldMap.set(entry.key, field);
      }

      if (entry.label.length > field.name.length) field.name = entry.label;

      field.assignments = upsertAssignment(field.assignments, {
        role,
        screens: [group.id],
        mode,
        required:
          mode === "input" &&
          !group.id.includes("display") &&
          !entry.key.endsWith("Display"),
      });

      const tagSet = new Set(field.tags);
      inferTags(group.id, entry.key).forEach((tag) => tagSet.add(tag));
      field.tags = [...tagSet];
    }
  }

  return applyKnownReliabilityRules(
    [...fieldMap.values()].sort((a, b) => a.ref.localeCompare(b.ref)),
  );
}
