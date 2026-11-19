import { describe, expect, it } from "vitest";
import type { FileAttachmentMetaDto } from "@platform/api-client";
import { outputVersionEntries } from "../governed-property-documents-reads";

const P = "p-1";
const meta = (id: string, scope: string, scopeKey: string): FileAttachmentMetaDto => ({
  id,
  scope,
  scopeKey,
  fileName: `${id}.pdf`,
  contentType: "application/pdf",
  sizeBytes: 10,
  createdAtUtc: "2026-11-18T10:00:00Z",
});

describe("outputVersionEntries — the transaction's kept outputs (Omar 2026-11-18)", () => {
  it("lists every version newest first and marks the older ones superseded", () => {
    const entries = outputVersionEntries(P, [
      meta("a", "evaluator-report", `${P}:final:v1`),
      meta("b", "evaluator-report", `${P}:final:v2`),
      meta("c", "case-study-report", `${P}:case-study:v1`),
    ]);

    const valuation = entries.filter((e) => e.name.startsWith("تقرير التقييم"));
    expect(valuation.map((e) => [e.version, e.superseded])).toEqual([
      [2, false],
      [1, true],
    ]);
    expect(valuation[0]!.name).toBe("تقرير التقييم — النسخة 2");
    const study = entries.find((e) => e.name.startsWith("تقرير دراسة الحالة"))!;
    expect(study.superseded).toBe(false);
  });

  it("ignores other deeds and other scopes", () => {
    const entries = outputVersionEntries(P, [
      meta("x", "evaluator-report", "p-2:final:v1"),
      meta("y", "property-document", `PO-1:${P}`),
    ]);
    expect(entries).toEqual([]);
  });
});
