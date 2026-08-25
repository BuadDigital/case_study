export const KeyEnvelopeStatusValues = {
  Reviewer: "reviewer",
  Assessor: "assessor",
  External: "external",
  Returned: "returned",
  Cancelled: "cancelled",
} as const;

export type KeyEnvelopeStatus =
  | (typeof KeyEnvelopeStatusValues)[keyof typeof KeyEnvelopeStatusValues]
  | string;

export const KeyReceiveScenarioValues = {
  Court: "court",
  Missing: "missing",
  ThirdParty: "third_party",
  Party: "party",
} as const;

export type KeyReceiveScenario =
  | (typeof KeyReceiveScenarioValues)[keyof typeof KeyReceiveScenarioValues]
  | string;

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
  revenueEntitlementAtUtc?: string | null;
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
  /** بلا مبلغ = مؤشر استحقاق تُسعّره المالية عند فوترة إنفاذ. */
  feeAmountSar?: number | null;
  collectionStatus?: string;
  invoiceReference?: string | null;
  collectedAtUtc?: string | null;
  createdByName: string;
  createdAtUtc: string;
};

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
    case KeyEnvelopeStatusValues.Reviewer:
      return "بعهدة المراجع";
    case KeyEnvelopeStatusValues.Assessor:
      return "بعهدة المعاين";
    case KeyEnvelopeStatusValues.External:
      return "بعهدة طرف خارجي";
    case KeyEnvelopeStatusValues.Returned:
      return "مُرجَع للمحكمة";
    case KeyEnvelopeStatusValues.Cancelled:
      return "ملغى";
    default:
      return status || "—";
  }
}

/** HTML Case Study.html `keyStat` colors. */
export function envelopeStatusColor(status: string): string {
  switch (status) {
    case KeyEnvelopeStatusValues.Reviewer:
      return "#378add";
    case KeyEnvelopeStatusValues.Assessor:
      return "#2f7a4d";
    case KeyEnvelopeStatusValues.External:
      return "#b58a3c";
    case KeyEnvelopeStatusValues.Returned:
    case KeyEnvelopeStatusValues.Cancelled:
      return "#8a8d96";
    default:
      return "#8a8d96";
  }
}

/** HTML Case Study.html `keyScen` labels. */
export function scenarioLabel(scenario: string): string {
  switch (scenario) {
    case KeyReceiveScenarioValues.Missing:
      return "مفقودة (ميدانياً)";
    case KeyReceiveScenarioValues.Party:
    case KeyReceiveScenarioValues.ThirdParty:
      return "استلام من طرف آخر";
    case KeyReceiveScenarioValues.Court:
    default:
      return "استلام من المحكمة";
  }
}

export function scenarioColor(scenario: string): string {
  switch (scenario) {
    case KeyReceiveScenarioValues.Missing:
      return "#d9694f";
    case KeyReceiveScenarioValues.ThirdParty:
    case KeyReceiveScenarioValues.Party:
      return "#b58a3c";
    case KeyReceiveScenarioValues.Court:
    default:
      return "#2f7a4d";
  }
}

const NON_DIGIT_PATTERN = /\D/g;

/** Display ref like HTML `keyRef` → ENV-2026-NNN */
export function envelopeDisplayRef(id: string, createdAtUtc?: string): string {
  const digits = id.replace(NON_DIGIT_PATTERN, "");
  const n = (digits.slice(-3) || "1").padStart(3, "0");
  const year = createdAtUtc
    ? new Date(createdAtUtc).getFullYear() || 2026
    : 2026;
  return `ENV-${year}-${n}`;
}

export function isEnvelopeOutOfCustody(status: string): boolean {
  return (
    status === KeyEnvelopeStatusValues.Returned
    || status === KeyEnvelopeStatusValues.External
  );
}

export const KeyAssignmentStatusValues = {
  Matched: "matched",
  Partial: "partial",
  Unmatched: "unmatched",
  UnmatchedInspected: "unmatched_inspected",
  Missing: "missing",
  Pending: "pending",
} as const;

/** Field match result statuses from HTML `openKeyResult` / `keyAssign`. */
export type KeyAssignmentMatchStatus =
  | typeof KeyAssignmentStatusValues.Matched
  | typeof KeyAssignmentStatusValues.Partial
  | typeof KeyAssignmentStatusValues.Unmatched
  | typeof KeyAssignmentStatusValues.UnmatchedInspected
  | typeof KeyAssignmentStatusValues.Missing;

/** HTML Case Study.html `keyAssign` labels. */
export function assignmentStatusLabel(status: string): string {
  switch (status) {
    case KeyAssignmentStatusValues.Matched:
      return "مطابق";
    case KeyAssignmentStatusValues.Partial:
      return "مطابقة جزئية";
    case KeyAssignmentStatusValues.Unmatched:
      return "غير مطابق";
    case KeyAssignmentStatusValues.UnmatchedInspected:
      return "غير مطابق — تمت المعاينة";
    case KeyAssignmentStatusValues.Missing:
      return "مفقود";
    case KeyAssignmentStatusValues.Pending:
    default:
      return "لم تتم التجربة";
  }
}

export function assignmentStatusColor(status: string): string {
  switch (status) {
    case KeyAssignmentStatusValues.Matched:
      return "#2f7a4d";
    case KeyAssignmentStatusValues.Partial:
      return "#b58a3c";
    case KeyAssignmentStatusValues.Unmatched:
      return "#d9694f";
    case KeyAssignmentStatusValues.UnmatchedInspected:
      return "#8a5e14";
    case KeyAssignmentStatusValues.Missing:
      return "#c0553d";
    case KeyAssignmentStatusValues.Pending:
    default:
      return "#d9a441";
  }
}

export const KeyHandoffKindValues = {
  Internal: "internal",
  External: "external",
  ReceiveBack: "receive_back",
  ReturnCourt: "return_court",
} as const;

export const KeyHandoffStatusValues = {
  PendingConfirm: "pending_confirm",
  Confirmed: "confirmed",
  Completed: "completed",
} as const;

export const PropertyCourtAccessStatusValues = {
  EnabledNoKey: "enabled_no_key",
  SuspendedEviction: "suspended_eviction",
} as const;

/** HTML Case Study.html `keyHoType` labels. */
export function handoffKindLabel(kind: string): string {
  switch (kind) {
    case KeyHandoffKindValues.Internal:
      return "تسليم داخلي";
    case KeyHandoffKindValues.External:
      return "تسليم خارجي";
    case KeyHandoffKindValues.ReceiveBack:
      return "استرداد الظرف";
    case KeyHandoffKindValues.ReturnCourt:
      return "إرجاع للمحكمة";
    default:
      return kind;
  }
}

export function handoffKindColor(kind: string): string {
  switch (kind) {
    case KeyHandoffKindValues.Internal:
      return "#2f7a4d";
    case KeyHandoffKindValues.External:
      return "#b58a3c";
    case KeyHandoffKindValues.ReceiveBack:
      return "#378add";
    case KeyHandoffKindValues.ReturnCourt:
      return "#8a8d96";
    default:
      return "#8a8d96";
  }
}

export function handoffStateLabel(status: string): string {
  switch (status) {
    case KeyHandoffStatusValues.PendingConfirm:
      return "بانتظار التأكيد";
    case KeyHandoffStatusValues.Confirmed:
      return "مؤكّد";
    case KeyHandoffStatusValues.Completed:
      return "منجز";
    default:
      return status || "—";
  }
}

export function handoffStateColor(status: string): string {
  switch (status) {
    case KeyHandoffStatusValues.PendingConfirm:
      return "#d9a441";
    case KeyHandoffStatusValues.Completed:
    case KeyHandoffStatusValues.Confirmed:
      return "#2f7a4d";
    default:
      return "#8a8d96";
  }
}

export function studyHoldLabel(status: string): string {
  switch (status) {
    case PropertyCourtAccessStatusValues.EnabledNoKey:
      return "تمكين بدون مفتاح";
    case PropertyCourtAccessStatusValues.SuspendedEviction:
      return "معلّق — محظر إخلاء";
    default:
      return "بدون قيد";
  }
}

export function timelineEventLabel(eventType: string): string {
  switch (eventType.toLowerCase()) {
    case "created":
      return "تسجيل الظرف";
    case "assignment_added":
      return "إضافة إسناد صك";
    case "assignment_confirmed":
      return "تأكيد مطابقة المفتاح";
    case "handoff_created":
      return "إنشاء تسليم";
    case "handoff_confirmed":
      return "تأكيد الاستلام";
    case "fee_generated":
      return "توليد بند الأتعاب";
    case "fee_collected":
      return "تحصيل الأتعاب";
    case "revenue_entitlement":
      return "استحقاق إيراد استلام المفاتيح";
    case "status_changed":
      return "تغيير الحالة";
    default: {
      // Fallback: humanize snake_case codes instead of showing English raw keys
      const raw = eventType.trim();
      if (!raw) return "—";
      if (!/[a-z]/i.test(raw) || !raw.includes("_")) return raw;
      return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .join(" ");
    }
  }
}
