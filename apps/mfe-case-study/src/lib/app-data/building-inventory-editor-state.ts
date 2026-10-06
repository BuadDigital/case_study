/**
 * Pure rules behind `useBuildingInventoryEditor` and the inspector's «جدول الحصر» card:
 * which rows are sent, how server ids are adopted by the rows still on screen, the
 * Arabic messages, and when the card is shown / warns. No React, no I/O.
 */
import type { ApiErr, BuildingInventoryLineDto } from "@platform/api-client";
import { inspectionHasStructures } from "./specialist-components";

/** Who is editing the table — decides the wording of a refusal. */
export type BuildingInventoryActor = "specialist" | "inspector";

/** Debounce of the inspector's autosave (one PUT per pause in typing). */
export const INVENTORY_AUTOSAVE_MS = 1200;

export const INSPECTOR_INVENTORY_LOAD_FAILED =
  "تعذّر تحميل جدول الحصر — يلزم اتصال مرة واحدة على الأقل لتنزيله على الجهاز";
export const SPECIALIST_INVENTORY_LOAD_FAILED = "تعذّر تحميل مكونات العقار";

/** A row nobody typed into: «إضافة بند» then nothing — it is neither sent nor reported. */
export function isBlankComponentLine(line: BuildingInventoryLineDto): boolean {
  return (
    !line.label.trim() &&
    !(line.areaSqm ?? "").toString().trim() &&
    !(line.notes ?? "").trim() &&
    line.buildRatioPct == null &&
    line.repeatedFloorCount == null
  );
}

/**
 * The rows a save sends: every non-blank row, numbered in screen order. `kept` are the
 * original row objects (the ids of the reply line up with them index by index).
 */
export function componentLinesForSave(lines: BuildingInventoryLineDto[]): {
  kept: BuildingInventoryLineDto[];
  body: BuildingInventoryLineDto[];
} {
  const kept = lines.filter((line) => !isBlankComponentLine(line));
  return { kept, body: kept.map((line, i) => ({ ...line, sortOrder: i })) };
}

/**
 * After a save, the rows that went out without an id are known to the server. Rows still on
 * screen take those ids by identity (`keyOf` follows a row through edits), so a quick edit
 * right after the save updates the stored row instead of re-sending it as a new one — and
 * rows edited or added meanwhile keep exactly what was typed.
 */
export function adoptSavedLineIds(
  current: BuildingInventoryLineDto[],
  sent: BuildingInventoryLineDto[],
  saved: BuildingInventoryLineDto[],
  keyOf: (line: BuildingInventoryLineDto) => string | undefined,
): BuildingInventoryLineDto[] {
  if (sent.length !== saved.length) return current;
  const idByKey = new Map<string, string>();
  sent.forEach((line, i) => {
    const key = keyOf(line);
    const id = saved[i]?.id;
    if (!line.id && key && id) idByKey.set(key, id);
  });
  if (idByKey.size === 0) return current;
  return current.map((line) => {
    const key = keyOf(line);
    const id = key ? idByKey.get(key) : undefined;
    return id && !line.id ? { ...line, id } : line;
  });
}

/** Is the on-screen table exactly what was sent (no edit, add or removal since)? */
export function sameRows(
  a: BuildingInventoryLineDto[],
  b: BuildingInventoryLineDto[],
): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/** Why a save was refused, in the words of whoever is editing. */
export function inventorySaveMessage(res: ApiErr, actor: BuildingInventoryActor): string {
  const fieldError =
    res.errors?._ ||
    res.errors?.lines ||
    res.errors?.componentsText ||
    Object.values(res.errors ?? {})[0];
  if (res.kind === "forbidden") {
    return (
      fieldError ||
      (actor === "inspector"
        ? "لا يمكنك تعديل جدول الحصر بعد إرسال المعاينة"
        : "جدول الحصر يعبّئه المعاين المُسنَد قبل إرسال معاينته، ويعدّله أخصائي دراسة الحالة")
    );
  }
  return fieldError || "تعذّر حفظ جدول الحصر";
}

/**
 * The inspector's card is shown for any non-land asset, and for a land asset only when he
 * answered «نعم» to «هل في الأرض مبانٍ أو ملاحق تستحق التقييم؟». It is hidden for land + «لا»
 * and for land with no answer yet (the question comes first).
 */
export function inspectorInventoryVisible(declaration: {
  assetSubject?: string | null;
  landHasValuableStructures?: string | null;
}): boolean {
  return inspectionHasStructures(declaration);
}

export const INSPECTOR_INVENTORY_EMPTY_WARNING =
  "جدول الحصر فارغ — أضف المباني والملاحق التي تستحق التقييم (ولو غرفة حارس)، فأخصائي دراسة الحالة يحتاج سطراً واحداً على الأقل قبل قبول المعاينة.";

/** One short line under the table: what happened to the typing. Null when there is nothing to say. */
export function inventorySaveStatus(input: {
  saving: boolean;
  dirty: boolean;
  queued: boolean;
}): string | null {
  if (input.saving) return "جاري الحفظ…";
  if (input.dirty) return "تعديلات غير محفوظة بعد";
  if (input.queued) return "محفوظ على الجهاز — سيُرسل عند عودة الاتصال";
  return null;
}

/** Soft, non-blocking: shown while the table is empty and the property has structures. */
export function inspectorInventoryWarning(input: {
  hasStructures: boolean;
  lines: BuildingInventoryLineDto[];
  loading: boolean;
}): string | null {
  if (!input.hasStructures || input.loading) return null;
  return input.lines.every(isBlankComponentLine) ? INSPECTOR_INVENTORY_EMPTY_WARNING : null;
}
