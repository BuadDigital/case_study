import { describe, expect, it } from "vitest";
import {
  PARTY_DATA_SECTIONS,
  applyPartyFieldEdits,
  partyProvenanceLines,
  partyValueText,
  readPartyPayloadValue,
} from "../property-party-fields";

describe("property-party-fields", () => {
  it("reads top-level and one-level nested payload values", () => {
    const payload = { roomCount: "3", featureValues: { facade: "شمالية" } };
    expect(readPartyPayloadValue(payload, "roomCount")).toBe("3");
    expect(readPartyPayloadValue(payload, "featureValues.facade")).toBe("شمالية");
    expect(readPartyPayloadValue(payload, "featureValues.kitchen")).toBeUndefined();
    expect(readPartyPayloadValue(payload, "missing.key")).toBeUndefined();
  });

  it("applies edits without mutating the source and copies the nested parent", () => {
    const payload = { roomCount: "3", featureValues: { facade: "شمالية" } };
    const next = applyPartyFieldEdits(payload, {
      roomCount: "4",
      "featureValues.kitchen": "جيد",
      siteConfirmed: true,
    });
    expect(next).toEqual({
      roomCount: "4",
      siteConfirmed: true,
      featureValues: { facade: "شمالية", kitchen: "جيد" },
    });
    expect(payload).toEqual({ roomCount: "3", featureValues: { facade: "شمالية" } });
  });

  it("creates the nested parent when the payload lacks it", () => {
    expect(applyPartyFieldEdits({}, { "checklist.technical_notes_text": "x" })).toEqual({
      checklist: { technical_notes_text: "x" },
    });
  });

  it("summarises values for read-only rows", () => {
    expect(partyValueText(["كهرباء", "مياه"])).toBe("كهرباء، مياه");
    expect(partyValueText([{ a: 1 }, { a: 2 }])).toBe("2 عنصر");
    expect(partyValueText(null)).toBe("");
    expect(partyValueText(false)).toBe("");
  });

  it("phrases who wrote and who edited, and tolerates a missing writer", () => {
    expect(partyProvenanceLines(undefined)).toEqual({ written: null, edited: null });

    const both = partyProvenanceLines({
      writtenByName: "أحمد",
      writtenByRole: "field-inspector",
      writtenAtUtc: "2026-09-20T08:00:00Z",
      editedByName: "أسامة",
      editedByRole: "case-specialist",
      editedAtUtc: "2026-09-20T09:00:00Z",
    });
    expect(both.written).toContain("كتبه أحمد (المعاين)");
    expect(both.edited).toContain("عدّله أسامة (أخصائي دراسة الحالة)");

    const legacy = partyProvenanceLines({ editedByName: "أسامة" });
    expect(legacy.written).toBe("الكاتب الأصلي غير مسجَّل");
    expect(legacy.edited).toContain("عدّله أسامة");
  });

  it("has unique keys per section", () => {
    for (const section of PARTY_DATA_SECTIONS) {
      const keys = section.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
