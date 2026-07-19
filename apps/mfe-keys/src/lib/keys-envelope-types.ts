export type KeyEnvelopeStatus =
  | "reviewer"
  | "assessor"
  | "external"
  | "returned"
  | string;

export type KeyReceiveScenario = "court" | "missing" | "third_party" | string;

export type KeyEnvelopeLinkedProperty = {
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  ownerName: string;
  city: string;
  court: string;
  circuit: string;
  requestNumber: string;
};

export type KeyEnvelopeAssignment = {
  id: string;
  deedNumber: string;
  propertyId?: string | null;
  status: string;
  notes?: string | null;
  confirmedByName?: string | null;
  confirmedAtUtc?: string | null;
};

export type KeyEnvelopeHandoff = {
  id: string;
  kind: string;
  fromParty: string;
  toParty: string;
  toUserId?: string | null;
  letterNumber?: string | null;
  letterAttachmentId?: string | null;
  notes?: string | null;
  status: string;
  confirmedByName?: string | null;
  confirmedAtUtc?: string | null;
  createdByName: string;
  createdAtUtc: string;
};

export type KeyEnvelopeTimelineEntry = {
  id: string;
  eventType: string;
  summary: string;
  actorName: string;
  createdAtUtc: string;
};

export type KeyEnvelopeRow = {
  id: string;
  requestNumber: string;
  court: string;
  circuit: string;
  keysCountLabeled: number;
  keysCountActual: number;
  countMismatch: boolean;
  receiptAttachmentId?: string | null;
  photoAttachmentId?: string | null;
  thirdPartyLetterAttachmentId?: string | null;
  contactPhones?: string | null;
  notes?: string | null;
  receiveScenario: KeyReceiveScenario;
  status: KeyEnvelopeStatus;
  feeGenerated: boolean;
  feeAmountSar?: number | null;
  createdByName: string;
  createdAtUtc: string;
  assignments: KeyEnvelopeAssignment[];
  handoffs: KeyEnvelopeHandoff[];
  timeline: KeyEnvelopeTimelineEntry[];
  linkedProperties: KeyEnvelopeLinkedProperty[];
};

export type KeyEnvelopeFeeReportRow = {
  envelopeId: string;
  requestNumber: string;
  court: string;
  circuit: string;
  photoAttachmentId?: string | null;
  receiptAttachmentId?: string | null;
  feeAmountSar: number;
  collectionStatus?: string;
  invoiceReference?: string | null;
  collectedAtUtc?: string | null;
  createdByName: string;
  createdAtUtc: string;
};

export function feeCollectionStatusLabel(status?: string): string {
  switch (status) {
    case "collected":
      return "محصّل";
    case "open":
    default:
      return "مفتوح";
  }
}

export type PropertyCourtAccessRow = {
  id: string;
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  requestNumber: string;
  hasEnablingLetter: boolean;
  enablingLetterAttachmentId?: string | null;
  hasEvictionNotice: boolean;
  evictionNoticeAttachmentId?: string | null;
  studyHoldStatus: string;
  contactPhones?: string | null;
  notes?: string | null;
  updatedByName: string;
  updatedAtUtc: string;
};

export function envelopeStatusLabel(status: string): string {
  switch (status) {
    case "reviewer":
      return "بعهدة المراجع";
    case "assessor":
      return "بعهدة المعاين";
    case "external":
      return "بعهدة طرف خارجي";
    case "returned":
      return "مُرجع للمحكمة";
    default:
      return status || "—";
  }
}

export function envelopeStatusTone(
  status: string,
): "success" | "warning" | "danger" | "default" | "info" {
  switch (status) {
    case "reviewer":
      return "info";
    case "assessor":
      return "warning";
    case "external":
      return "default";
    case "returned":
      return "success";
    default:
      return "default";
  }
}

export function scenarioLabel(scenario: string): string {
  switch (scenario) {
    case "missing":
      return "ب — مفاتيح غير موجودة";
    case "third_party":
      return "ج — عند طرف آخر";
    default:
      return "أ — استلام من المحكمة";
  }
}

export function assignmentStatusLabel(status: string): string {
  switch (status) {
    case "matched":
      return "مطابق";
    case "unmatched":
      return "غير مطابق";
    default:
      return "غير مؤكد";
  }
}

export function handoffKindLabel(kind: string): string {
  switch (kind) {
    case "internal":
      return "تسليم داخلي";
    case "external":
      return "تسليم خارجي";
    case "receive_back":
      return "استلام من طرف";
    case "return_court":
      return "إرجاع للمحكمة";
    default:
      return kind;
  }
}

export function studyHoldLabel(status: string): string {
  switch (status) {
    case "enabled_no_key":
      return "تمكين بدون مفتاح";
    case "suspended_eviction":
      return "معلّق — محظر إخلاء";
    default:
      return "بدون قيد";
  }
}
