import { describe, expect, it } from "vitest";
import type { ValuationValueDocumentDto } from "@platform/api-client";
import {
  availableDocumentApproaches,
  draftsFromDocuments,
  valueDocumentDraftErrors,
  valueDocumentsSavePayload,
} from "../value-documents-state";

function doc(id: string, partial: Partial<ValuationValueDocumentDto> = {}): ValuationValueDocumentDto {
  return {
    attachmentId: id,
    labelAr: `مستند ${id}`,
    fileName: `${id}.pdf`,
    contentType: "application/pdf",
    status: "pending",
    missing: false,
    ...partial,
  };
}

describe("value documents", () => {
  it("offers only approaches the system does not value itself", () => {
    expect(availableDocumentApproaches(["market", "cost"]).map((a) => a.key)).toEqual(["income"]);
  });

  it("builds drafts from saved uses and leaves «لا يؤثر» documents out of the payload", () => {
    const docs = [
      doc("a", { effect: "indicator", approachKey: "income", methodName: "الطريقة المتبقية", value: 900000 }),
      doc("b"),
      doc("c", { effect: "addition", value: 150000 }),
    ];
    const drafts = draftsFromDocuments(docs);
    expect(drafts.b!.effect).toBe("none");
    expect(valueDocumentsSavePayload(docs, drafts)).toEqual([
      { attachmentId: "a", effect: "indicator", approachKey: "income", methodName: "الطريقة المتبقية", value: 900000 },
      { attachmentId: "c", effect: "addition", value: 150000 },
    ]);
  });

  it("rejects an internal approach, a repeated method and a zero value", () => {
    const docs = [doc("a"), doc("b"), doc("c")];
    const errors = valueDocumentDraftErrors(
      docs,
      {
        a: { effect: "indicator", approachKey: "market", methodName: "طريقة", value: "10" },
        b: { effect: "indicator", approachKey: "income", methodName: "الطريقة المتبقية", value: "10" },
        c: { effect: "indicator", approachKey: "income", methodName: " الطريقة  المتبقية", value: "10" },
      },
      ["market"],
    );
    expect(Object.keys(errors).sort()).toEqual(["a", "c"]);
    expect(
      valueDocumentDraftErrors([doc("x")], { x: { effect: "addition", approachKey: "", methodName: "", value: "0" } }, []),
    ).toHaveProperty("x");
  });
});
