/**
 * The inspector's view of the key envelope gate. «No key yet» does not stop an inspection, but the
 * answer is sent with it — so an answer we do not have (still loading, failed, offline before the
 * first load, no session for the modules API) is «unknown», never a guessed «no».
 */
export type InspectorKeyGateStatus =
  | "known"
  | "loading"
  | "offline"
  | "error"
  | "unavailable";

/**
 * Reads the gate query. A value already loaded wins, even when a later refetch failed or the device
 * went offline: it is the last answer the server gave on this device.
 */
export function inspectorKeyGateStatus(input: {
  /** `null` = the query ran without a modules-API session; `undefined` = no answer yet. */
  data: { keyAvailable: boolean } | null | undefined;
  isError: boolean;
  /** The query is waiting for the network (react-query `isPaused`). */
  isPaused: boolean;
  offline: boolean;
}): InspectorKeyGateStatus {
  if (input.data) return "known";
  if (input.isPaused || input.offline) return "offline";
  if (input.isError) return "error";
  if (input.data === null) return "unavailable";
  return "loading";
}

/** What the inspector reads when the key status is unknown; `null` while loading or known. */
export function inspectorKeyGateProblem(status: InspectorKeyGateStatus): string | null {
  if (status === "offline") {
    return "حالة المفتاح غير معروفة دون اتصال — تُحمَّل تلقائياً عند عودة الاتصال.";
  }
  if (status === "error") return "تعذّر تحميل حالة المفتاح من ظرف المفاتيح.";
  if (status === "unavailable") {
    return "تعذّر التحقق من حالة المفتاح — تحقق من تسجيل الدخول ثم أعد المحاولة.";
  }
  return null;
}

type InspectorKeySubmitGate =
  | { ok: true; keyAvailable: boolean }
  | { ok: false; reason: string };

/** Submit waits for a known key status; the reason is shown like the other submit blockers. */
export function inspectorKeySubmitGate(gate: {
  status: InspectorKeyGateStatus;
  keyAvailable: boolean | null;
}): InspectorKeySubmitGate {
  if (gate.status === "known" && gate.keyAvailable !== null) {
    return { ok: true, keyAvailable: gate.keyAvailable };
  }
  if (gate.status === "offline") {
    return {
      ok: false,
      reason: "لا يمكن إرسال المعاينة قبل معرفة حالة المفتاح — أرسلها بعد عودة الاتصال.",
    };
  }
  if (gate.status === "error" || gate.status === "unavailable") {
    return {
      ok: false,
      reason: "تعذّر تحميل حالة المفتاح — اضغط «إعادة المحاولة» عند ملاحظة المفتاح ثم أرسل المعاينة.",
    };
  }
  return { ok: false, reason: "جارٍ تحميل حالة المفتاح — انتظر لحظة ثم أرسل المعاينة." };
}
