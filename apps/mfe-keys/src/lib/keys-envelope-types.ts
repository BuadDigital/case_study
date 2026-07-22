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
  operationsTaskId?: string | null;
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
      return "مُرجَع للمحكمة";
    case "cancelled":
      return "ملغى";
    default:
      return status || "—";
  }
}

/** HTML Case Study.html `keyStat` colors. */
export function envelopeStatusColor(status: string): string {
  switch (status) {
    case "reviewer":
      return "#378add";
    case "assessor":
      return "#2f7a4d";
    case "external":
      return "#b58a3c";
    case "returned":
    case "cancelled":
      return "#8a8d96";
    default:
      return "#8a8d96";
  }
}

export function envelopeStatusTone(
  status: string,
): "success" | "warning" | "danger" | "default" | "info" {
  switch (status) {
    case "reviewer":
      return "info";
    case "assessor":
      return "success";
    case "external":
      return "warning";
    case "returned":
      return "default";
    default:
      return "default";
  }
}

/** HTML Case Study.html `keyScen` labels. */
export function scenarioLabel(scenario: string): string {
  switch (scenario) {
    case "missing":
      return "مفقودة (ميدانياً)";
    case "party":
    case "third_party":
      return "استلام من طرف آخر";
    case "court":
    default:
      return "استلام من المحكمة";
  }
}

export function scenarioColor(scenario: string): string {
  switch (scenario) {
    case "missing":
      return "#d9694f";
    case "third_party":
    case "party":
      return "#b58a3c";
    case "court":
    default:
      return "#2f7a4d";
  }
}

/** Display ref like HTML `keyRef` → ENV-2026-NNN */
export function envelopeDisplayRef(id: string, createdAtUtc?: string): string {
  const digits = id.replace(/\D/g, "");
  const n = (digits.slice(-3) || "1").padStart(3, "0");
  const year = createdAtUtc
    ? new Date(createdAtUtc).getFullYear() || 2026
    : 2026;
  return `ENV-${year}-${n}`;
}

export function isEnvelopeOutOfCustody(status: string): boolean {
  return status === "returned" || status === "external";
}

/** Field match result statuses from HTML `openKeyResult` / `keyAssign`. */
export type KeyAssignmentMatchStatus =
  | "matched"
  | "partial"
  | "unmatched"
  | "unmatched_inspected"
  | "missing";

/** HTML Case Study.html `keyAssign` labels. */
export function assignmentStatusLabel(status: string): string {
  switch (status) {
    case "matched":
      return "مطابق";
    case "partial":
      return "مطابقة جزئية";
    case "unmatched":
      return "غير مطابق";
    case "unmatched_inspected":
      return "غير مطابق — تمت المعاينة";
    case "missing":
      return "مفقود";
    case "pending":
    default:
      return "لم تتم التجربة";
  }
}

export function assignmentStatusColor(status: string): string {
  switch (status) {
    case "matched":
      return "#2f7a4d";
    case "partial":
      return "#b58a3c";
    case "unmatched":
      return "#d9694f";
    case "unmatched_inspected":
      return "#8a5e14";
    case "missing":
      return "#c0553d";
    case "pending":
    default:
      return "#d9a441";
  }
}

/** HTML Case Study.html `keyHoType` labels. */
export function handoffKindLabel(kind: string): string {
  switch (kind) {
    case "internal":
      return "تسليم داخلي";
    case "external":
      return "تسليم خارجي";
    case "receive_back":
      return "استرداد الظرف";
    case "return_court":
      return "إرجاع للمحكمة";
    default:
      return kind;
  }
}

export function handoffKindColor(kind: string): string {
  switch (kind) {
    case "internal":
      return "#2f7a4d";
    case "external":
      return "#b58a3c";
    case "receive_back":
      return "#378add";
    case "return_court":
      return "#8a8d96";
    default:
      return "#8a8d96";
  }
}

export function handoffStateLabel(status: string): string {
  switch (status) {
    case "pending_confirm":
      return "بانتظار التأكيد";
    case "completed":
    case "confirmed":
      return "مكتمل";
    default:
      return status || "—";
  }
}

export function handoffStateColor(status: string): string {
  switch (status) {
    case "pending_confirm":
      return "#d9a441";
    case "completed":
    case "confirmed":
      return "#2f7a4d";
    default:
      return "#8a8d96";
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
