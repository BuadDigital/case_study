import type { CustomAssignedScreen } from "@platform/types";
import { nextFieldRef } from "./logic";
import type {
  FieldDictionaryAssignment,
  FieldDictionaryField,
  FieldDictionaryFieldType,
  FieldDictionaryState,
} from "./types";

function mergeAssignments(
  left: FieldDictionaryAssignment[],
  right: FieldDictionaryAssignment[],
): FieldDictionaryAssignment[] {
  const map = new Map<string, FieldDictionaryAssignment>();
  const assignmentKey = (item: FieldDictionaryAssignment) =>
    `${item.role}:${item.mode}`;

  for (const item of [...left, ...right]) {
    const key = assignmentKey(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...item,
        screens: [...new Set(item.screens)],
      });
      continue;
    }
    map.set(key, {
      ...existing,
      screens: [...new Set([...existing.screens, ...item.screens])],
      required: existing.required || item.required,
      final: existing.final || item.final,
    });
  }

  return [...map.values()];
}

function mergeFieldPair(
  existing: FieldDictionaryField,
  incoming: FieldDictionaryField,
): FieldDictionaryField {
  return {
    ...existing,
    name:
      incoming.name.trim().length > existing.name.trim().length
        ? incoming.name
        : existing.name,
    type: incoming.type ?? existing.type,
    tags: [...new Set([...existing.tags, ...incoming.tags])],
    source: existing.source ?? incoming.source,
    parent: existing.parent ?? incoming.parent,
    child: existing.child ?? incoming.child,
    persisted: existing.persisted || incoming.persisted,
    assignments: mergeAssignments(existing.assignments, incoming.assignments),
  };
}

/** يدمج طبقات الحقول — الطبقة الأخيرة تفوز على الاسم/النوع عند التعارض. */
export function mergeFieldDictionaryIndex(
  ...layers: FieldDictionaryField[][]
): FieldDictionaryField[] {
  const byKey = new Map<string, FieldDictionaryField>();

  for (const layer of layers) {
    for (const field of layer) {
      const existing = byKey.get(field.key);
      byKey.set(
        field.key,
        existing ? mergeFieldPair(existing, field) : { ...field },
      );
    }
  }

  return ensureUniqueRefs([...byKey.values()]);
}

function ensureUniqueRefs(fields: FieldDictionaryField[]): FieldDictionaryField[] {
  const used = new Set<string>();
  const allocated: FieldDictionaryField[] = [];

  for (const field of fields) {
    if (!used.has(field.ref)) {
      used.add(field.ref);
      allocated.push(field);
      continue;
    }
    const ref = nextFieldRef(allocated);
    used.add(ref);
    allocated.push({ ...field, ref });
  }

  return allocated.sort((a, b) => a.ref.localeCompare(b.ref));
}

/** يستخرج حقول الشاشات الديناميكية المحفوظة لإدراجها في الفهرس. */
export function fieldsFromCustomAssignedScreens(
  screens: readonly CustomAssignedScreen[],
): FieldDictionaryField[] {
  const fields: FieldDictionaryField[] = [];

  for (const screen of screens) {
    const definition = screen.definition;
    if (!definition?.fields?.length) continue;

    const screenCode = screen.code?.trim() || screen.id;
    const screenLabel = screen.name?.trim() || screenCode;
    const screenKey = `custom-screen:${screen.id}`;

    for (const field of definition.fields) {
      const required = definition.bindings?.some(
        (binding) => binding.fieldId === field.id && binding.required,
      );
      fields.push({
        id: field.id,
        ref: field.ref,
        key: `dynamic:${screenCode}:${field.ref}`,
        name: field.name,
        type: field.type as FieldDictionaryFieldType,
        tags: ["شاشة ديناميكية", screenLabel],
        source: screenLabel,
        persisted: true,
        assignments: [
          {
            role: (screen.ownerRole?.trim() || "cdo") as FieldDictionaryAssignment["role"],
            screens: [screenKey],
            mode: "input",
            required,
          },
        ],
      });
    }
  }

  return fields;
}

export function syncFieldDictionaryState(input: {
  catalogFields: FieldDictionaryField[];
  dynamicFields?: FieldDictionaryField[];
  stored?: FieldDictionaryState | null;
  defaultTags: string[];
}): FieldDictionaryState {
  const mergedFields = mergeFieldDictionaryIndex(
    input.catalogFields,
    input.dynamicFields ?? [],
    input.stored?.fields ?? [],
  );

  return {
    fields: mergedFields,
    tags:
      input.stored?.tags?.length && input.stored.tags.length > 0
        ? input.stored.tags
        : input.defaultTags,
  };
}

export function fieldDictionaryHasNewKeys(
  before: readonly FieldDictionaryField[],
  after: readonly FieldDictionaryField[],
): boolean {
  const beforeKeys = new Set(before.map((field) => field.key));
  return after.some((field) => !beforeKeys.has(field.key));
}
