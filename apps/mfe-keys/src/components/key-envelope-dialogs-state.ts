/**
 * Pure helpers behind the key-envelope detail dialogs — match-result
 * validation, the receive dialog's holder label, the court-access draft
 * transitions and request body, and the toast copy. No React, no I/O.
 * Delivery validation stays in `key-envelope-detail-state`.
 */
import type { UpsertPropertyCourtAccessRequest } from "@platform/api-client";
import type {
  KeyAssignmentMatchStatus,
  KeyEnvelopeHandoff,
  KeyEnvelopeRow,
  PropertyCourtAccessRow,
} from "../lib/keys-envelope-types";
import {
  deliverHandoffKindLabel,
  displayPersonName,
} from "./key-envelope-detail-state";

/** Note stored with a full match — the field confirmation wording. */
export const MATCHED_DEFAULT_NOTE = "فُتح العقار بالمفاتيح (تأكيد ميداني)";

export type MatchResultValidation =
  | { ok: true; status: KeyAssignmentMatchStatus; note: string }
  | { ok: false; error: string };

/** A tile must be chosen; anything but a full match needs a note. */
export function validateMatchResult(
  selected: KeyAssignmentMatchStatus | "",
  note: string,
): MatchResultValidation {
  if (!selected) return { ok: false, error: "اختر نتيجة المطابقة أولاً." };
  if (selected !== "matched" && !note.trim()) {
    return {
      ok: false,
      error:
        "الملاحظة إلزامية لغير المطابق الكامل — سجّل تفاصيل الوحدات والمفاتيح.",
    };
  }
  return {
    ok: true,
    status: selected,
    note: selected === "matched" ? MATCHED_DEFAULT_NOTE : note.trim(),
  };
}

/** The latest handoff still waiting on the clerk's confirmation. */
export function findPendingHandoff(
  env: KeyEnvelopeRow,
): KeyEnvelopeHandoff | undefined {
  return [...env.handoffs].reverse().find((h) => h.status === "pending_confirm");
}

/** Who holds the envelope right now, for the receive dialog copy. */
export function receiveHolderLabel(
  env: KeyEnvelopeRow,
  pending: KeyEnvelopeHandoff | undefined,
): string {
  const rawHolder =
    pending?.toParty || env.handoffs[env.handoffs.length - 1]?.toParty || "";
  const resolved = displayPersonName(rawHolder);
  return resolved === "—" ? "الطرف الحالي" : resolved;
}

export function receiveSuccessMessage(requestNumber: string): string {
  return `تم تأكيد استلام الظرف ${requestNumber}.`;
}

export function deliverSuccessMessage(
  kind: string,
  requestNumber: string,
): string {
  return `تم تسجيل «${deliverHandoffKindLabel(kind)}» على الظرف ${requestNumber}.`;
}

export function courtAccessSavedMessage(deedNumber: string): string {
  return `تم تحديث مسار الدخول لصك ${deedNumber}.`;
}

/** Dashed attachment tile title: uploaded name, else replace/upload prompt. */
export function attachmentTileTitle(
  uploadedName: string,
  existingId: string | null | undefined,
  labels: { replace: string; upload: string },
): string {
  if (uploadedName) return `تم الإرفاق: ${uploadedName}`;
  return existingId ? labels.replace : labels.upload;
}

export type CourtAccessDraft = {
  hasEnablingLetter: boolean;
  enablingLetterId: string | null;
  enablingLetterName: string;
  hasEvictionNotice: boolean;
  evictionNoticeId: string | null;
  evictionNoticeName: string;
  contactPhones: string;
  notes: string;
};

export type CourtAccessAttachmentKind = "enabling" | "eviction";

export function initialCourtAccessDraft(
  current?: PropertyCourtAccessRow,
): CourtAccessDraft {
  return {
    hasEnablingLetter: current?.hasEnablingLetter ?? false,
    enablingLetterId: current?.enablingLetterAttachmentId ?? null,
    enablingLetterName: "",
    hasEvictionNotice: current?.hasEvictionNotice ?? false,
    evictionNoticeId: current?.evictionNoticeAttachmentId ?? null,
    evictionNoticeName: "",
    contactPhones: current?.contactPhones ?? "",
    notes: current?.notes ?? "",
  };
}

const CLEARED_ENABLING = {
  hasEnablingLetter: false,
  enablingLetterId: null,
  enablingLetterName: "",
} as const;

const CLEARED_EVICTION = {
  hasEvictionNotice: false,
  evictionNoticeId: null,
  evictionNoticeName: "",
} as const;

/**
 * Clicking a «مسار الدخول» tile. «لا يوجد» clears both; «تمكين» drops the
 * eviction notice and either flags the letter or asks for the file when none
 * is attached yet; «محظر إخلاء» keeps the letter and does the same for the notice.
 */
export function applyCourtAccessOption(
  optionId: "none" | "enabling" | "eviction",
  draft: CourtAccessDraft,
): { draft: CourtAccessDraft; pickFile?: CourtAccessAttachmentKind } {
  if (optionId === "none") {
    return { draft: { ...draft, ...CLEARED_ENABLING, ...CLEARED_EVICTION } };
  }
  if (optionId === "enabling") {
    const next = { ...draft, ...CLEARED_EVICTION };
    if (!draft.hasEnablingLetter && !draft.enablingLetterId) {
      return { draft: next, pickFile: "enabling" };
    }
    return { draft: { ...next, hasEnablingLetter: true } };
  }
  if (!draft.hasEvictionNotice && !draft.evictionNoticeId) {
    return { draft, pickFile: "eviction" };
  }
  return { draft: { ...draft, hasEvictionNotice: true } };
}

export function courtAccessAttachmentUploaded(
  draft: CourtAccessDraft,
  kind: CourtAccessAttachmentKind,
  id: string,
  fileName: string,
): CourtAccessDraft {
  if (kind === "enabling") {
    return {
      ...draft,
      hasEnablingLetter: true,
      enablingLetterId: id,
      enablingLetterName: fileName,
    };
  }
  return {
    ...draft,
    hasEvictionNotice: true,
    evictionNoticeId: id,
    evictionNoticeName: fileName,
  };
}

export function courtAccessAttachmentRemoved(
  draft: CourtAccessDraft,
  kind: CourtAccessAttachmentKind,
): CourtAccessDraft {
  return kind === "enabling"
    ? { ...draft, ...CLEARED_ENABLING }
    : { ...draft, ...CLEARED_EVICTION };
}

/** A freshly uploaded id wins; otherwise keep the saved id only while the flag is on. */
export function buildCourtAccessBody(
  propertyId: string,
  draft: CourtAccessDraft,
  current?: PropertyCourtAccessRow,
): UpsertPropertyCourtAccessRequest {
  return {
    propertyId,
    hasEnablingLetter: draft.hasEnablingLetter,
    enablingLetterAttachmentId:
      draft.enablingLetterId ??
      (draft.hasEnablingLetter
        ? (current?.enablingLetterAttachmentId ?? null)
        : null),
    hasEvictionNotice: draft.hasEvictionNotice,
    evictionNoticeAttachmentId:
      draft.evictionNoticeId ??
      (draft.hasEvictionNotice
        ? (current?.evictionNoticeAttachmentId ?? null)
        : null),
    contactPhones: draft.contactPhones.trim() || null,
    notes: draft.notes.trim() || null,
  };
}
