/**
 * Pure form state behind `RegisterKeyEnvelopeModal` — the reducer over the
 * draft, the field validation in submit order, the request body, the fee
 * notice copy, and the request-number suggestion index. No React, no I/O.
 */
import type { CreateEnvelopeInput } from "../lib/keys-envelope-api";
import type { KeyEnvelopeLinkedProperty } from "../lib/keys-envelope-types";

/** Narrow UI scenarios — do not Extract from KeyReceiveScenario (`| string` widens to string → never). */
export type SourceKind = "court" | "missing" | "third_party";

export type RequestSuggestion = {
  requestNumber: string;
  court: string;
  circuit: string;
  deedCount: number;
  sampleDeed: string;
};

export type FilePick = { file: File; attachmentId?: string };

export const SOURCE_OPTIONS = [
  { id: "court" as const, label: "المحكمة" },
  { id: "third_party" as const, label: "طرف آخر" },
  { id: "missing" as const, label: "مفقودة" },
] as const;

export const REQUEST_SUGGESTION_LIMIT = 12;
/** Linked properties are looked up once the request number has this many chars. */
export const LINKED_LOOKUP_MIN_CHARS = 2;
export const LINKED_LOOKUP_DEBOUNCE_MS = 350;
export const SUGGESTION_BLUR_CLOSE_MS = 150;

export type RegisterTextField =
  | "requestNumber"
  | "court"
  | "circuit"
  | "notes"
  | "partyName"
  | "partyOrg"
  | "partyRole"
  | "partyPhone"
  | "missingPhones";

export type RegisterPickField = "photo" | "receipt" | "thirdPartyLetter";

export type RegisterFormState = Record<RegisterTextField, string> &
  Record<RegisterPickField, FilePick | null> & {
    source: SourceKind;
    keysCountLabeled: string;
    keysCountActual: string;
    formError: string;
  };

export type RegisterFormAction =
  | { type: "set-text"; field: RegisterTextField; value: string }
  | { type: "set-source"; source: SourceKind }
  | { type: "set-keys-count"; value: string }
  | { type: "pick-suggestion"; suggestion: RequestSuggestion }
  | { type: "set-pick"; field: RegisterPickField; pick: FilePick | null }
  | { type: "apply-linked-defaults"; court: string; circuit: string }
  | { type: "set-error"; error: string };

export function initialRegisterFormState(
  initialRequestNumber: string,
): RegisterFormState {
  return {
    source: "court",
    requestNumber: initialRequestNumber.trim(),
    court: "",
    circuit: "",
    keysCountLabeled: "1",
    keysCountActual: "1",
    notes: "",
    partyName: "",
    partyOrg: "",
    partyRole: "",
    partyPhone: "",
    missingPhones: "",
    photo: null,
    receipt: null,
    thirdPartyLetter: null,
    formError: "",
  };
}

export function registerFormReducer(
  state: RegisterFormState,
  action: RegisterFormAction,
): RegisterFormState {
  switch (action.type) {
    case "set-text":
      return { ...state, [action.field]: action.value };
    case "set-source":
      return { ...state, source: action.source };
    case "set-keys-count":
      return {
        ...state,
        keysCountActual: action.value,
        keysCountLabeled: action.value,
      };
    case "pick-suggestion":
      return {
        ...state,
        requestNumber: action.suggestion.requestNumber,
        court: action.suggestion.court,
        circuit: action.suggestion.circuit,
        formError: "",
      };
    case "set-pick":
      return { ...state, [action.field]: action.pick };
    case "apply-linked-defaults":
      // Only fill what the clerk has not typed yet.
      return {
        ...state,
        court: state.court.trim() || action.court,
        circuit: state.circuit.trim() || action.circuit,
      };
    case "set-error":
      return { ...state, formError: action.error };
    default:
      return state;
  }
}

/** The count inputs are free text; anything unparsable counts as zero. */
export function parseKeysCount(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/** First blocking problem in submit order, or null when the draft can be sent. */
export function validateRegisterForm(state: RegisterFormState): string | null {
  const { source } = state;
  const actual = parseKeysCount(state.keysCountActual);
  if (!state.requestNumber.trim()) return "رقم طلب إنفاذ مطلوب.";
  if (source === "third_party" && !state.partyName.trim()) {
    return "يلزم إدخال اسم الطرف المسلِّم.";
  }
  if (source === "third_party" && !state.partyPhone.trim()) {
    return "يلزم إدخال رقم جوال الطرف المسلِّم.";
  }
  if (source === "missing" && !state.missingPhones.trim()) {
    return "يلزم إدخال أرقام التواصل لسيناريو المفاتيح المفقودة.";
  }
  if (source === "missing") {
    if (actual < 0) return "عدد المفاتيح غير صالح.";
  } else if (actual < 1) {
    return "عدد المفاتيح الفعلي يجب أن يكون ١ على الأقل.";
  }
  if (source === "court" && !state.photo?.attachmentId) {
    return "صورة الظرف مطلوبة لإثبات أتعاب الاستلام.";
  }
  if (source === "court" && !state.receipt?.attachmentId) {
    return "خطاب الاستلام مطلوب لسيناريو المحكمة.";
  }
  if (source === "third_party" && !state.thirdPartyLetter?.attachmentId) {
    return "خطاب الطرف الثالث مطلوب.";
  }
  return null;
}

/** Third party: name — «ممثل org» — «بصفتها role» — phone; missing: the phones; court: nothing. */
export function buildRegisterContact(state: RegisterFormState): string {
  if (state.source === "third_party") {
    return [
      state.partyName.trim(),
      state.partyOrg.trim() ? `ممثل ${state.partyOrg.trim()}` : "",
      state.partyRole.trim() ? `بصفتها ${state.partyRole.trim()}` : "",
      state.partyPhone.trim(),
    ]
      .filter(Boolean)
      .join(" — ");
  }
  return state.source === "missing" ? state.missingPhones.trim() : "";
}

export function buildRegisterEnvelopeInput(
  state: RegisterFormState,
  opts: { operationsTaskId?: string; linked: KeyEnvelopeLinkedProperty[] },
): CreateEnvelopeInput {
  const missing = state.source === "missing";
  return {
    requestNumber: state.requestNumber.trim(),
    court: state.court.trim() || "—",
    circuit: state.circuit.trim() || "—",
    keysCountLabeled: missing ? 0 : parseKeysCount(state.keysCountLabeled),
    keysCountActual: missing ? 0 : parseKeysCount(state.keysCountActual),
    receiveScenario: state.source,
    photoAttachmentId: state.photo?.attachmentId,
    receiptAttachmentId: state.receipt?.attachmentId,
    thirdPartyLetterAttachmentId: state.thirdPartyLetter?.attachmentId,
    contactPhones: buildRegisterContact(state),
    notes: state.notes,
    operationsTaskId: opts.operationsTaskId?.trim() || undefined,
    assignments: opts.linked.map((p) => ({
      deedNumber: p.deedNumber,
      propertyId: p.propertyId,
    })),
  };
}

export function registerSuccessMessage(
  requestNumber: string,
  entitled: boolean,
): string {
  return `تم تسجيل الظرف ${requestNumber}${
    entitled ? " وإثبات استحقاق أتعاب الاستلام من إنفاذ." : "."
  }`;
}

export type FeeNoticePresentation = {
  ok: boolean;
  background: string;
  color: string;
  text: string;
};

/** The fee strip under the form — info for missing keys, green once the photo is up, amber otherwise. */
export function feeNoticePresentation(
  source: SourceKind,
  photoReady: boolean,
): FeeNoticePresentation {
  if (source === "missing") {
    return {
      ok: true,
      background: "color-mix(in srgb, var(--info, #4a7bb5) 12%, transparent)",
      color: "var(--info-text, #2f5a8a)",
      text: "سيناريو المفاتيح المفقودة لا يُولِّد أتعاب استلام تلقائية — يُوثَّق التواصل فقط.",
    };
  }
  if (photoReady) {
    return {
      ok: true,
      background: "color-mix(in srgb, #3f8f5f 12%, transparent)",
      color: "#2f7a4d",
      text: "تم إثبات أتعاب استلام المفاتيح — صورة الظرف توثّق استحقاق الشركة لدى مركز الإسناد والتصفية.",
    };
  }
  return {
    ok: false,
    background: "color-mix(in srgb, #d9a441 14%, transparent)",
    color: "#8a5e14",
    text: "صورة الظرف هي إثبات أتعاب استلام المفاتيح التي تستحقها الشركة من مركز الإسناد والتصفية. أتعاب الزيارة نفسها تُستحق عبر إسناد مهمة زيارة المحكمة.",
  };
}

/** The slice of a work-order DTO the suggestion index reads. */
export type SuggestionSourceOrder = {
  properties?:
    | {
        isRemoved?: boolean | null;
        requestNumber?: string | null;
        court?: string | null;
        circuit?: string | null;
        deedNumber?: string | null;
      }[]
    | null;
};

/** One suggestion per open request number, deeds counted, sorted numerically (Arabic collation). */
export function buildRequestSuggestions(
  orders: readonly SuggestionSourceOrder[],
): RequestSuggestion[] {
  const byRequest = new Map<string, RequestSuggestion>();
  for (const order of orders) {
    for (const prop of order.properties ?? []) {
      if (prop.isRemoved) continue;
      const req = (prop.requestNumber ?? "").trim();
      if (!req) continue;
      const existing = byRequest.get(req);
      if (existing) {
        existing.deedCount += 1;
        continue;
      }
      byRequest.set(req, {
        requestNumber: req,
        court: (prop.court ?? "").trim(),
        circuit: (prop.circuit ?? "").trim(),
        deedCount: 1,
        sampleDeed: (prop.deedNumber ?? "").trim(),
      });
    }
  }
  return [...byRequest.values()].sort((a, b) =>
    a.requestNumber.localeCompare(b.requestNumber, "ar", { numeric: true }),
  );
}

export function filterRequestSuggestions(
  suggestions: RequestSuggestion[],
  query: string,
): RequestSuggestion[] {
  const q = query.trim();
  const list = !q
    ? suggestions
    : suggestions.filter((s) => s.requestNumber.includes(q));
  return list.slice(0, REQUEST_SUGGESTION_LIMIT);
}

export function suggestionDeedSummary(s: RequestSuggestion): string {
  return s.deedCount > 1 ? `${s.deedCount} صكوك` : `صك ${s.sampleDeed || "—"}`;
}
