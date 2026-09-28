/**
 * Pure rules behind the «مستندات ذات قيمة» panel: the appraiser's per-document draft (no effect,
 * approach indicator, or an amount added after the liquidation discount), its checks and the
 * save payload. Mirrors backend `ValueDocumentUseRules`. No React, no I/O.
 */
import type {
  SaveValuationValueDocumentUseRequest,
  ValuationValueDocumentDto,
  ValueDocumentApproachKey,
} from "@platform/api-client";

export type ValueDocumentEffectChoice = "none" | "indicator" | "addition";

export type ValueDocumentDraft = {
  effect: ValueDocumentEffectChoice;
  approachKey: ValueDocumentApproachKey | "";
  methodName: string;
  value: string;
};

export type ValueDocumentDrafts = Record<string, ValueDocumentDraft>;

export const VALUE_DOCUMENT_APPROACHES: readonly {
  key: ValueDocumentApproachKey;
  labelAr: string;
}[] = [
  { key: "market", labelAr: "أسلوب السوق" },
  { key: "cost", labelAr: "أسلوب التكلفة" },
  { key: "income", labelAr: "أسلوب الدخل" },
];

export const VALUE_DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار اعتماد الأخصائي",
  approved: "معتمد من الأخصائي",
  rejected: "مرفوض من الأخصائي",
};

/** Approaches a document indicator may use — those the system does not value itself. */
export function availableDocumentApproaches(
  internalApproachKinds: readonly string[],
): typeof VALUE_DOCUMENT_APPROACHES {
  const internal = new Set(internalApproachKinds.map((k) => k.toLowerCase()));
  return VALUE_DOCUMENT_APPROACHES.filter((a) => !internal.has(a.key));
}

export function draftsFromDocuments(
  documents: readonly ValuationValueDocumentDto[],
): ValueDocumentDrafts {
  const drafts: ValueDocumentDrafts = {};
  for (const d of documents) {
    drafts[d.attachmentId] = {
      effect: d.effect ?? "none",
      approachKey: d.approachKey ?? "",
      methodName: d.methodName ?? "",
      value: d.value != null ? String(d.value) : "",
    };
  }
  return drafts;
}

function parseAmount(raw: string): number {
  const n = Number(raw.replace(/[,٬\s]/g, "").replace("٫", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizeMethod(name: string): string {
  return name.trim().split(/\s+/).join(" ");
}

/** Field errors keyed by attachment id (empty = ready to save). */
export function valueDocumentDraftErrors(
  documents: readonly ValuationValueDocumentDto[],
  drafts: ValueDocumentDrafts,
  internalApproachKinds: readonly string[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const internal = new Set(internalApproachKinds.map((k) => k.toLowerCase()));
  const seenMethods = new Set<string>();
  for (const d of documents) {
    const draft = drafts[d.attachmentId];
    if (!draft || draft.effect === "none") continue;
    if (d.missing) {
      errors[d.attachmentId] = "المستند لم يعد على العقار — اجعله «لا يؤثر»";
      continue;
    }
    if (parseAmount(draft.value) <= 0) {
      errors[d.attachmentId] = "أدخل قيمة أكبر من صفر";
      continue;
    }
    if (draft.effect !== "indicator") continue;
    if (!draft.approachKey) {
      errors[d.attachmentId] = "اختر الأسلوب";
    } else if (internal.has(draft.approachKey)) {
      errors[d.attachmentId] = "هذا الأسلوب مستخدم داخلياً في التقييم";
    } else if (normalizeMethod(draft.methodName).length < 2) {
      errors[d.attachmentId] = "اكتب اسم الطريقة";
    } else {
      const key = `${draft.approachKey}|${normalizeMethod(draft.methodName)}`;
      if (seenMethods.has(key)) {
        errors[d.attachmentId] = "هذه الطريقة مختارة من مستند آخر — كل طريقة مرة واحدة";
      }
      seenMethods.add(key);
    }
  }
  return errors;
}

/** Documents with an effect, in list order; «لا يؤثر» documents are left out. */
export function valueDocumentsSavePayload(
  documents: readonly ValuationValueDocumentDto[],
  drafts: ValueDocumentDrafts,
): SaveValuationValueDocumentUseRequest[] {
  const uses: SaveValuationValueDocumentUseRequest[] = [];
  for (const d of documents) {
    const draft = drafts[d.attachmentId];
    if (!draft || draft.effect === "none") continue;
    const value = parseAmount(draft.value);
    uses.push(
      draft.effect === "indicator"
        ? {
            attachmentId: d.attachmentId,
            effect: "indicator",
            approachKey: draft.approachKey || null,
            methodName: normalizeMethod(draft.methodName),
            value,
          }
        : { attachmentId: d.attachmentId, effect: "addition", value },
    );
  }
  return uses;
}
