import {
  listValuationRequests,
  submitValuationImpediment,
  submitValuationReport,
} from "@platform/api-client";
import type { VrRow } from "@platform/app-shared/prototype/constants";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

function mapStatus(status: string): VrRow["status"] {
  if (status === "done") return "done";
  if (status === "fail") return "fail";
  return "progress";
}

export async function loadValuationRequests(): Promise<VrRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];

  const result = await listValuationRequests(config);
  if (!result.ok) return [];

  return result.data.map((row) => ({
    recordId: row.id,
    id: row.displayId,
    propId: row.propId,
    area: row.area,
    type: row.type,
    appraiser: row.appraiser,
    status: mapStatus(row.status),
    date: row.date,
  }));
}

export async function submitValuationRequestReport(
  recordId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, message: "واجهة التقييم غير متصلة بالخادم" };

  const result = await submitValuationReport(config, recordId);
  if (result.ok) return { ok: true };
  if (result.kind === "auth") return { ok: false, message: "انتهت الجلسة — سجّل الدخول مجدداً" };
  if (result.kind === "not_found") return { ok: false, message: "طلب التقييم غير موجود" };
  return { ok: false, message: "تعذّر إرسال التقرير — حاول لاحقاً" };
}

export async function submitValuationRequestImpediment(
  recordId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, message: "واجهة التقييم غير متصلة بالخادم" };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, message: "سبب التعذّر مطلوب" };

  const result = await submitValuationImpediment(config, recordId, trimmed);
  if (result.ok) return { ok: true };
  if (result.kind === "auth") return { ok: false, message: "انتهت الجلسة — سجّل الدخول مجدداً" };
  if (result.kind === "not_found") return { ok: false, message: "طلب التقييم غير موجود" };
  return { ok: false, message: "تعذّر تسجيل التعذّر — حاول لاحقاً" };
}

export function valuationApiEnabled(): boolean {
  return prototypeModulesApiConfig() !== null;
}
