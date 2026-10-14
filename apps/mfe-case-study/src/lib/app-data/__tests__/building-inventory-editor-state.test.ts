import { describe, expect, it } from "vitest";
import type { BuildingInventoryLineDto } from "@platform/api-client";
import {
  INSPECTOR_INVENTORY_EMPTY_WARNING,
  adoptSavedLineIds,
  componentLinesForSave,
  inspectorInventoryVisible,
  inspectorInventoryWarning,
  inventorySaveMessage,
  inventorySaveStatus,
  isBlankComponentLine,
  sameRows,
} from "../building-inventory-editor-state";
import { emptyComponentLine } from "../specialist-components";

function line(label: string, extra: Partial<BuildingInventoryLineDto> = {}): BuildingInventoryLineDto {
  return { ...emptyComponentLine(0), label, areaSqm: "100", ...extra };
}

describe("rows a save sends", () => {
  it("drops untouched blank rows and numbers the rest in screen order", () => {
    const a = line("الدور الأرضي");
    const blank = emptyComponentLine(1);
    const b = line("غرفة حارس", { id: "g1" });
    const { kept, body } = componentLinesForSave([a, blank, b]);
    expect(kept).toEqual([a, b]);
    expect(kept[0]).toBe(a);
    expect(body.map((l) => [l.label, l.sortOrder])).toEqual([
      ["الدور الأرضي", 0],
      ["غرفة حارس", 1],
    ]);
    expect(body[1]?.id).toBe("g1");
  });

  it("a row with some data but no name is not blank (the save reports it)", () => {
    expect(isBlankComponentLine(emptyComponentLine(0))).toBe(true);
    expect(isBlankComponentLine({ ...emptyComponentLine(0), areaSqm: "30" })).toBe(false);
    expect(isBlankComponentLine({ ...emptyComponentLine(0), notes: "ملحوظة" })).toBe(false);
  });
});

describe("adopting the ids of a save reply", () => {
  const keys = new WeakMap<object, string>();
  const keyOf = (l: BuildingInventoryLineDto) => keys.get(l);
  const tag = (l: BuildingInventoryLineDto, key: string) => {
    keys.set(l, key);
    return l;
  };

  it("gives new rows still on screen their server ids, so the next save updates instead of re-adding", () => {
    const sent = [tag(line("أ"), "k1"), tag(line("ب", { id: "old" }), "k2"), tag(line("ج"), "k3")];
    const saved = [line("أ", { id: "s1" }), line("ب", { id: "old" }), line("ج", { id: "s3" })];
    // while the save was in the air the user edited «أ» (new object, same key) and added «د»
    const editedA = tag(line("أ معدّل"), "k1");
    const added = line("د");
    const current = [editedA, sent[1]!, sent[2]!, added];

    const next = adoptSavedLineIds(current, sent, saved, keyOf);

    expect(next.map((l) => [l.label, l.id])).toEqual([
      ["أ معدّل", "s1"],
      ["ب", "old"],
      ["ج", "s3"],
      ["د", undefined],
    ]);
    expect(next[3]).toBe(added);
  });

  it("leaves rows the user removed alone and never overwrites an id", () => {
    const sent = [tag(line("أ"), "r1"), tag(line("ب"), "r2")];
    const saved = [line("أ", { id: "s1" }), line("ب", { id: "s2" })];
    const current = [sent[1]!]; // «أ» was removed meanwhile
    expect(adoptSavedLineIds(current, sent, saved, keyOf).map((l) => l.id)).toEqual(["s2"]);

    const already = [{ ...sent[1]!, id: "mine" }];
    keys.set(already[0]!, "r2");
    expect(adoptSavedLineIds(already, sent, saved, keyOf)[0]?.id).toBe("mine");
  });

  it("does nothing when the reply does not line up with what was sent", () => {
    const sent = [tag(line("أ"), "m1")];
    const current = [sent[0]!];
    expect(adoptSavedLineIds(current, sent, [], keyOf)).toBe(current);
  });

  it("knows whether the screen still shows exactly what was sent", () => {
    const a = line("أ");
    expect(sameRows([a], [a])).toBe(true);
    expect(sameRows([a], [{ ...a }])).toBe(false);
    expect(sameRows([a], [a, a])).toBe(false);
  });
});

describe("messages", () => {
  it("shows the server's reason, else a fitting default per actor", () => {
    expect(
      inventorySaveMessage({ ok: false, kind: "validation", errors: { _: "المعاينة أُرسلت" } }, "inspector"),
    ).toBe("المعاينة أُرسلت");
    expect(inventorySaveMessage({ ok: false, kind: "forbidden" }, "inspector")).toContain("بعد إرسال المعاينة");
    expect(inventorySaveMessage({ ok: false, kind: "forbidden" }, "specialist")).toContain("أخصائي دراسة الحالة");
    expect(inventorySaveMessage({ ok: false, kind: "server" }, "specialist")).toBe("تعذّر حفظ جدول الحصر");
  });

  it("one short status line for the typing", () => {
    expect(inventorySaveStatus({ saving: true, dirty: true, queued: false })).toBe("جاري الحفظ…");
    expect(inventorySaveStatus({ saving: false, dirty: true, queued: false })).toContain("غير محفوظة");
    expect(inventorySaveStatus({ saving: false, dirty: false, queued: true })).toContain("عودة الاتصال");
    expect(inventorySaveStatus({ saving: false, dirty: false, queued: false })).toBeNull();
  });
});

describe("the inspector's card", () => {
  it("is shown for a non-land asset, and for land only when he answered yes to valuable structures", () => {
    expect(inspectorInventoryVisible({})).toBe(true);
    expect(inspectorInventoryVisible({ assetSubject: "فيلا" })).toBe(true);
    expect(inspectorInventoryVisible({ assetSubject: "أرض", landHasValuableStructures: "yes" })).toBe(true);
    // land + no, and land not answered yet (the question comes first): hidden
    expect(inspectorInventoryVisible({ assetSubject: "أرض", landHasValuableStructures: "no" })).toBe(false);
    expect(inspectorInventoryVisible({ assetSubject: "أرض", landHasValuableStructures: "" })).toBe(false);
  });

  it("warns softly only for an empty table on a property with structures", () => {
    const empty = { hasStructures: true, lines: [emptyComponentLine(0)], loading: false };
    expect(inspectorInventoryWarning(empty)).toBe(INSPECTOR_INVENTORY_EMPTY_WARNING);
    expect(inspectorInventoryWarning({ ...empty, lines: [] })).toBe(INSPECTOR_INVENTORY_EMPTY_WARNING);
    expect(inspectorInventoryWarning({ ...empty, lines: [line("الدور الأرضي")] })).toBeNull();
    expect(inspectorInventoryWarning({ ...empty, hasStructures: false })).toBeNull();
    expect(inspectorInventoryWarning({ ...empty, loading: true })).toBeNull();
  });
});
