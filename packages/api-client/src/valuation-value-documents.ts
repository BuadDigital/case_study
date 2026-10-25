import { sendValuationResource, type ValuationResourceResult } from "./valuation-resource";
import type { ValuationSelectionsApiConfig } from "./valuation-comparable-selections";

/** null = no effect. */
export type ValueDocumentEffect = "indicator" | "addition";

export type ValueDocumentApproachKey = "market" | "cost" | "income";

/** A «مستند ذو قيمة» of the request's property with the appraiser's decision on it. */
export type ValuationValueDocumentDto = {
  attachmentId: string;
  labelAr: string;
  fileName: string;
  contentType: string;
  createdAtUtc?: string | null;
  /** The case specialist's decision: pending / approved / rejected. */
  status: string;
  reviewNote?: string | null;
  /** Used, but no longer on the property. */
  missing: boolean;
  effect?: ValueDocumentEffect | null;
  approachKey?: ValueDocumentApproachKey | null;
  methodName?: string | null;
  value?: number | null;
};

export type ValuationValueDocumentsDto = {
  valuationRequestId: string;
  /** Approaches valued internally — a document indicator cannot use them. */
  internalApproachKinds: string[];
  documents: ValuationValueDocumentDto[];
};

export type SaveValuationValueDocumentUseRequest = {
  attachmentId: string;
  effect: ValueDocumentEffect;
  approachKey?: ValueDocumentApproachKey | null;
  methodName?: string | null;
  value: number;
};

export async function getValuationValueDocuments(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<ValuationResourceResult<ValuationValueDocumentsDto>> {
  return sendValuationResource(config, valuationRequestId, "value-documents", INVALID_MESSAGE);
}

/** The appraiser's decision on each valued document; documents left out have no effect. */
export async function saveValuationValueDocuments(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  uses: SaveValuationValueDocumentUseRequest[],
): Promise<ValuationResourceResult<ValuationValueDocumentsDto>> {
  return sendValuationResource(config, valuationRequestId, "value-documents", INVALID_MESSAGE, { uses });
}

const INVALID_MESSAGE = "تعذّر حفظ أثر المستندات";
