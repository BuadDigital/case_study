const KeyEnvelopeStatusValues = {
  Reviewer: "reviewer",
  Assessor: "assessor",
  External: "external",
  Returned: "returned",
  Cancelled: "cancelled",
} as const;

type KeyEnvelopeStatus =
  | (typeof KeyEnvelopeStatusValues)[keyof typeof KeyEnvelopeStatusValues]
  | string;

const KeyReceiveScenarioValues = {
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
  /** in_envelope | with_user | returned_court | missing — where the deed's matching key is now. */
  keyLocation?: string;
  keyHolderUserId?: string | null;
  keyHolderLabel?: string | null;
  keyLocationAtUtc?: string | null;
  /**
   * Set while the deed's transaction is cancelled («إلغاء المعاملة»): the key stays with the property
   * and the envelope shows «عقار ملغى»; an untried key needs no trial any more.
   */
  propertyCancelledAtUtc?: string | null;
};

/** Where a deed's matching key may be. */
export const KeyLocationValues = {
  InEnvelope: "in_envelope",
  WithUser: "with_user",
  ReturnedCourt: "returned_court",
  Missing: "missing",
} as const;

export type KeyLocation =
  (typeof KeyLocationValues)[keyof typeof KeyLocationValues];

/**
 * The Arabic label of where a deed's matching key is.
 *
 * How it works: `with_user` → «عند <holder>» from `holderLabel`; `returned_court` →
 * «أُعيد للمحكمة»; `missing` → «مفقود»; anything else → «في الظرف».
 *
 * Edge cases: with_user without a holder name → «عند مستخدم»; an empty or unknown place (rows
 * from before key places existed) reads «في الظرف», the server's default.
 */
export function keyLocationLabel(
  location: string | null | undefined,
  holderLabel?: string | null,
): string {
  switch (location) {
    case KeyLocationValues.WithUser:
      return holderLabel?.trim() ? `عند ${holderLabel.trim()}` : "عند مستخدم";
    case KeyLocationValues.ReturnedCourt:
      return "أُعيد للمحكمة";
    case KeyLocationValues.Missing:
      return "مفقود";
    default:
      return "في الظرف";
  }
}

export function keyLocationColor(location: string | null | undefined): string {
  switch (location) {
    case KeyLocationValues.WithUser:
      return "#2f7a4d";
    case KeyLocationValues.ReturnedCourt:
      return "#8a8d96";
    case KeyLocationValues.Missing:
      return "#c0553d";
    default:
      return "#378add";
  }
}

/** Who holds the envelope. */
export const KeyHolderKindValues = {
  Reviewer: "reviewer",
  InternalUser: "internal_user",
  External: "external",
  Court: "court",
} as const;

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

type KeyEnvelopeTimelineEntry = {
  id: string;
  eventType: string;
  summary: string;
  actorName: string;
  createdAtUtc: string;
};

export type KeyEnvelopeRow = {
  id: string;
  requestNumber: string;
  /** Numbering workshop: internal reference KE-{year}-{5-digit sequence}. */
  referenceNumber?: string | null;
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
  /** The envelope's reviewer — an inspector's receive-back is handed to (and confirmed by) this user. */
  createdByUserId?: string | null;
  createdByName: string;
  createdAtUtc: string;
  operationsTaskId?: string | null;
  /** reviewer | internal_user | external | court — who holds the envelope now. */
  holderKind?: string;
  holderUserId?: string | null;
  holderLabel?: string | null;
  holderSinceUtc?: string | null;
  /** Every deed tried and every matching key back, returned or lost. */
  readyForCourtReturn?: boolean;
  assignments: KeyEnvelopeAssignment[];
  handoffs: KeyEnvelopeHandoff[];
  timeline: KeyEnvelopeTimelineEntry[];
  linkedProperties: KeyEnvelopeLinkedProperty[];
};

/**
 * «عند من الآن»: the envelope's one explicit holder as a short phrase.
 *
 * How it works: switches on `holderKind`: internal_user → the holder's name; external →
 * «طرف خارجي: <label>»; court → the label, else the envelope's court; reviewer → the label,
 * else the envelope's reviewer (`createdByName`), else «المراجع الحكومي».
 *
 * Edge cases: each kind falls back to a generic word when the label is empty; a row from
 * before the holder existed (no `holderKind`) shows its custody status label instead.
 */
export function envelopeHolderText(
  env: Pick<KeyEnvelopeRow, "holderKind" | "holderLabel" | "status" | "court" | "createdByName">,
): string {
  const label = env.holderLabel?.trim();
  switch (env.holderKind) {
    case KeyHolderKindValues.InternalUser:
      return label || "مستخدم داخلي";
    case KeyHolderKindValues.External:
      return label ? `طرف خارجي: ${label}` : "طرف خارجي";
    case KeyHolderKindValues.Court:
      return label || env.court || "المحكمة";
    case KeyHolderKindValues.Reviewer:
      return label || env.createdByName?.trim() || "المراجع الحكومي";
    default:
      return envelopeStatusLabel(env.status);
  }
}

/**
 * The «other keys» count: the envelope's keys that opened none of our
 * deeds — they stay in it and go back to the court with it.
 *
 * How it works: counts the deeds whose trial ended matched or partial and subtracts that from
 * `keysCountActual`.
 *
 * Edge cases: never negative — more matched deeds than counted keys (one key opening two
 * deeds, or a miscount) gives 0.
 */
export function otherKeysInEnvelope(
  env: Pick<KeyEnvelopeRow, "keysCountActual" | "assignments">,
): number {
  const matched = env.assignments.filter(
    (a) => a.status === "matched" || a.status === "partial",
  ).length;
  return Math.max(0, env.keysCountActual - matched);
}

export type KeyEnvelopeFeeReportRow = {
  envelopeId: string;
  requestNumber: string;
  court: string;
  circuit: string;
  photoAttachmentId?: string | null;
  receiptAttachmentId?: string | null;
  /** No amount = entitlement marker priced by finance when billing Enfaz. */
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


/** What an envelope without a server reference shows — never a composed number that reads like one. */
export const ENVELOPE_NO_REFERENCE_LABEL = "بلا رقم";

/**
 * The envelope's reference KE-YY-##### as the server allocated it at registration.
 *
 * How it works: returns the trimmed `referenceNumber`; otherwise «بلا رقم»
 * (`ENVELOPE_NO_REFERENCE_LABEL`). The id and creation date are no longer read.
 *
 * Edge cases: — no made-up fallback: it used to compose ENV-{year}-{last
 * three id digits}, which read like a real reference; an old envelope that was never numbered
 * now says so (search matches «بلا رقم», never "ENV-").
 */
export function envelopeDisplayRef(
  _id: string,
  _createdAtUtc?: string,
  referenceNumber?: string | null,
): string {
  const real = referenceNumber?.trim();
  return real || ENVELOPE_NO_REFERENCE_LABEL;
}

export function isEnvelopeOutOfCustody(status: string): boolean {
  return (
    status === KeyEnvelopeStatusValues.Returned
    || status === KeyEnvelopeStatusValues.External
  );
}

const KeyAssignmentStatusValues = {
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

const KeyHandoffKindValues = {
  Internal: "internal",
  External: "external",
  ReceiveBack: "receive_back",
  ReturnCourt: "return_court",
} as const;

const KeyHandoffStatusValues = {
  PendingConfirm: "pending_confirm",
  Confirmed: "confirmed",
  Completed: "completed",
} as const;

const PropertyCourtAccessStatusValues = {
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
      return "معلّق — محضر إخلاء";
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
    case "key_location_changed":
      return "تحديث مكان المفتاح";
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
