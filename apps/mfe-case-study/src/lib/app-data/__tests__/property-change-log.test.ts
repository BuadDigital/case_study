import { describe, expect, it } from "vitest";
import type { AuditLogDto } from "@platform/api-client/audit";
import { propertyFieldLabel, toPropertyChangeEntries } from "../property-change-log";

function row(overrides: Partial<AuditLogDto>): AuditLogDto {
  return {
    id: "a1",
    actorId: "u1",
    action: "case-study.property.fields-changed",
    entityType: "WorkOrderProperty",
    entityId: "p1",
    before: {},
    after: {},
    createdAtUtc: "2026-11-03T08:00:00Z",
    ...overrides,
  };
}

describe("property change log (ruling 2026-11-02)", () => {
  it("prints each changed field with its label, old and new value, and the editor's capacity", () => {
    const [entry] = toPropertyChangeEntries([
      row({
        before: { planNumber: "12", owners: [] },
        after: {
          fields: { planNumber: "13", owners: [{ name: "x" }] },
          actorName: "أسامة",
          actorRole: "case-specialist",
          actorSubRoles: ["study"],
          autosave: true,
        },
      }),
    ]);

    expect(entry.actorName).toBe("أسامة");
    expect(entry.actorCapacity).toBe("أخصائي دراسة حالة (دراسة العقار)");
    expect(entry.autosave).toBe(true);
    expect(entry.lines).toEqual([
      { field: "planNumber", label: propertyFieldLabel("planNumber"), before: "12", after: "13" },
      { field: "owners", label: propertyFieldLabel("owners"), before: "—", after: "1 عنصر" },
    ]);
  });

  it("names the appraiser plainly and skips rows of another shape", () => {
    const entries = toPropertyChangeEntries([
      row({ after: { fields: { area: "500" }, actorRole: "real-estate-appraiser" } }),
      row({ id: "a2", after: { something: true } }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].actorCapacity).toBe("مقيّم عقاري");
    expect(entries[0].lines[0].before).toBe("—");
  });

  it("falls back to the wire key for a field the catalog does not know", () => {
    expect(propertyFieldLabel("someNewField")).toBe("someNewField");
  });
});
