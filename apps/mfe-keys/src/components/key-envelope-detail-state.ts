/**
 * Pure helpers behind `KeyEnvelopeDetailPage` — date and person formatting,
 * envelope-derived labels and colors, the custody chain projection, and the
 * validation / body building for a delivery handoff. No React, no I/O.
 */
import {
  handoffKindColor,
  handoffKindLabel,
  handoffStateColor,
  handoffStateLabel,
  type KeyAssignmentMatchStatus,
  type KeyEnvelopeAssignment,
  type KeyEnvelopeHandoff,
  type KeyEnvelopeRow,
  type PropertyCourtAccessRow,
} from "../lib/keys-envelope-types";
import { displayPersonName as sharedDisplayPersonName } from "@platform/app-shared/app-data/person-display-name";

export type DetailTab = "assign" | "custody" | "timeline" | "court";

/** HTML detail dates show as DD/MM/YYYY (screenshot + sample data). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Hide raw user ids that were wrongly stored as display names. */
export function displayPersonName(value: string | null | undefined): string {
  return sharedDisplayPersonName(value, { fallback: "—" });
}

export function propertyLabel(
  env: KeyEnvelopeRow,
  a: KeyEnvelopeAssignment,
): string {
  const linked = env.linkedProperties.find(
    (p) =>
      p.deedNumber === a.deedNumber ||
      (a.propertyId && p.propertyId === a.propertyId),
  );
  if (!linked) return "العقار";
  const parts = [linked.city, linked.ownerName].filter(Boolean);
  return parts.length ? parts.join(" · ") : linked.poNumber || "العقار";
}

export function poForAssignment(
  env: KeyEnvelopeRow,
  a: KeyEnvelopeAssignment,
): string {
  const linked = env.linkedProperties.find(
    (p) =>
      p.deedNumber === a.deedNumber ||
      (a.propertyId && p.propertyId === a.propertyId),
  );
  return linked?.poNumber || "—";
}


/** HTML Case Study.html `keyHold` colors. */
export function studyHoldColor(status: string): string {
  switch (status) {
    case "suspended_eviction":
      return "#d9694f";
    case "enabled_no_key":
      return "#b58a3c";
    default:
      return "#8a8d96";
  }
}

export function timelineEventColor(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes("handoff") || t.includes("transfer")) return "#378add";
  if (
    t.includes("confirm") ||
    t.includes("match") ||
    t.includes("fee") ||
    t.includes("revenue")
  )
    return "#2f7a4d";
  if (t.includes("mismatch") || t.includes("missing") || t.includes("evict"))
    return "#d9694f";
  return "#8a8d96";
}

/** Exact tiles from HTML `openKeyResult` / Case Study.html. */
export const MATCH_RESULT_TILES: {
  id: KeyAssignmentMatchStatus;
  label: string;
  hint: string;
  color: string;
}[] = [
  {
    id: "matched",
    label: "مطابق",
    hint: "فُتح العقار بالمفاتيح",
    color: "#2f7a4d",
  },
  {
    id: "partial",
    label: "مطابقة جزئية",
    hint: "بعض الوحدات فقط",
    color: "#b58a3c",
  },
  {
    id: "unmatched",
    label: "غير مطابق",
    hint: "لا مفتاح مناسب",
    color: "#d9694f",
  },
  {
    id: "unmatched_inspected",
    label: "غير مطابق — تمت المعاينة",
    hint: "عوين العقار بالكامل رغم عدم المطابقة",
    color: "#8a5e14",
  },
  {
    id: "missing",
    label: "مفقود",
    hint: "لم يُعثر على المفتاح",
    color: "#c0553d",
  },
];

export const HANDOFF_NOTES_BY_KIND: Record<string, string> = {
  internal:
    "التسليم الداخلي يُسجَّل بحالة «بانتظار التأكيد» ثم يؤكّده المعاين — وتنتقل العهدة إليه.",
  external:
    "التسليم الخارجي يتطلب إثباتاً: صورة/مستند، أو بيانات التواصل للجهة.",
  return_court:
    "المحكمة جهة معرَّفة — لا يلزم إثبات استلام؛ الإرجاع يُنهي دورة الظرف.",
};

export const COURT_ACCESS_OPTIONS = [
  { id: "none" as const, label: "لا يوجد" },
  { id: "enabling" as const, label: "تمكين" },
  { id: "eviction" as const, label: "محظر إخلاء" },
] as const;

/** Pending matches float to the top of the assignment table. */
export function sortAssignmentsByPending(
  env: KeyEnvelopeRow | null,
): KeyEnvelopeAssignment[] {
  if (!env) return [];
  return [...env.assignments].sort((a, b) => {
    const ap = a.status === "pending" ? 0 : 1;
    const bp = b.status === "pending" ? 0 : 1;
    return ap - bp;
  });
}

/** Replace the saved row for a property, or append it when it is the first. */
export function upsertCourtAccessRow(
  rows: PropertyCourtAccessRow[],
  row: PropertyCourtAccessRow,
): PropertyCourtAccessRow[] {
  const idx = rows.findIndex((r) => r.propertyId === row.propertyId);
  if (idx === -1) return [...rows, row];
  const next = [...rows];
  next[idx] = row;
  return next;
}

/** Header action label — the same button receives, delivers or hands off. */
export function handoffButtonLabel(env: KeyEnvelopeRow | null): string {
  if (env?.status === "reviewer") return "تسليم الظرف";
  if (env?.status === "returned") return "مناولة";
  return "استلام الظرف";
}

export function envelopeHasAttachments(env: KeyEnvelopeRow | null): boolean {
  return Boolean(
    env?.photoAttachmentId ||
      env?.receiptAttachmentId ||
      env?.thirdPartyLetterAttachmentId ||
      env?.contactPhones,
  );
}

export type CustodyChainItem = {
  key: string;
  title: string;
  color: string;
  person: string;
  role: string;
  date: string;
  letter?: string | null;
  letterId?: string | null;
  stateLabel: string;
  stateColor: string;
  handoff?: KeyEnvelopeHandoff;
};

function custodyChainOrigin(env: KeyEnvelopeRow): string {
  return env.receiveScenario === "third_party" || env.receiveScenario === "party"
    ? `طرف آخر${env.contactPhones ? `: ${env.contactPhones}` : ""}`
    : env.court || "المحكمة";
}

function handoffRoleLabel(kind: string): string {
  if (kind === "internal") return "معاين ميداني";
  if (kind === "return_court") return "محكمة";
  if (kind === "external") return "طرف خارجي";
  return handoffKindLabel(kind);
}

/** Initial receipt followed by every recorded handoff, oldest first. */
export function buildCustodyChain(env: KeyEnvelopeRow): CustodyChainItem[] {
  return [
    {
      key: "initial",
      title: `استلام الظرف — بداية العهدة (من ${custodyChainOrigin(env)})`,
      color: "#378add",
      person: displayPersonName(env.createdByName),
      role: "مراجع حكومي",
      date: formatDate(env.createdAtUtc),
      stateLabel: "منجز",
      stateColor: "#2f7a4d",
    },
    ...env.handoffs.map((h) => ({
      key: h.id,
      title: handoffKindLabel(h.kind),
      color: handoffKindColor(h.kind),
      person: displayPersonName(h.toParty || h.fromParty),
      role: handoffRoleLabel(h.kind),
      date: formatDate(h.createdAtUtc),
      letter: h.letterNumber,
      letterId: h.letterAttachmentId,
      stateLabel: handoffStateLabel(h.status),
      stateColor: handoffStateColor(h.status),
      handoff: h,
    })),
  ];
}

export type DeliverHandoffBody = {
  kind: string;
  fromParty: string;
  toParty: string;
  toUserId: string | null;
  letterAttachmentId: string | null;
  notes: null;
};

export type DeliverHandoffDraft = {
  kind: string;
  toUserId: string;
  partyName: string;
  partyOrg: string;
  partyRole: string;
  partyPhone: string;
  letterId: string | null;
};

/** Field validation for the delivery modal — the request body, or the first error. */
export function buildDeliverHandoffBody(
  env: KeyEnvelopeRow,
  draft: DeliverHandoffDraft,
  inspectors: { id: string; name: string }[],
): { ok: true; body: DeliverHandoffBody } | { ok: false; error: string } {
  let toParty = "";
  let toUserIdVal: string | null = null;

  if (draft.kind === "internal") {
    if (!draft.toUserId.trim()) {
      return { ok: false, error: "اختر المستخدم من القائمة." };
    }
    toParty = inspectors.find((i) => i.id === draft.toUserId)?.name ?? "";
    toUserIdVal = draft.toUserId.trim();
  } else if (draft.kind === "external") {
    if (!draft.partyName.trim()) {
      return { ok: false, error: "اسم الطرف مطلوب." };
    }
    if (!draft.partyPhone.trim()) {
      return { ok: false, error: "رقم جوال الطرف الخارجي مطلوب." };
    }
    if (!draft.letterId) {
      return {
        ok: false,
        error: "يلزم إثبات التسليم: صوّر/ارفع مستنداً للتسليم.",
      };
    }
    toParty = [
      draft.partyName.trim(),
      draft.partyOrg.trim(),
      draft.partyRole.trim() ? `(${draft.partyRole.trim()})` : "",
      draft.partyPhone.trim(),
    ]
      .filter(Boolean)
      .join(" — ");
  } else {
    toParty = env.court || "المحكمة";
  }

  return {
    ok: true,
    body: {
      kind: draft.kind,
      fromParty: env.createdByName || "المراجع الحكومي",
      toParty,
      toUserId: toUserIdVal,
      letterAttachmentId: draft.letterId,
      notes: null,
    },
  };
}

export function deliverHandoffKindLabel(kind: string): string {
  if (kind === "internal") return "تسليم داخلي";
  if (kind === "external") return "تسليم خارجي";
  return "إرجاع للمحكمة";
}

/** The «لا يوجد» / «تمكين» / «محظر إخلاء» tile that reads as active. */
export function courtAccessOptionActive(
  optionId: "none" | "enabling" | "eviction",
  hasEnablingLetter: boolean,
  hasEvictionNotice: boolean,
): boolean {
  if (optionId === "none") return !hasEnablingLetter && !hasEvictionNotice;
  if (optionId === "enabling") return hasEnablingLetter && !hasEvictionNotice;
  return hasEvictionNotice;
}

export function courtAccessPreviewStatus(
  hasEnablingLetter: boolean,
  hasEvictionNotice: boolean,
): string {
  if (hasEvictionNotice) return "suspended_eviction";
  if (hasEnablingLetter) return "enabled_no_key";
  return "none";
}

/** Assignment confirmation column text when there is no action button. */
export function assignmentConfirmedByText(
  confirmedByName: string | null | undefined,
  status: string,
): string {
  const name = displayPersonName(confirmedByName);
  if (name !== "—") return `أكّده ${name}`;
  return status !== "pending" ? "مؤكّد" : "—";
}
