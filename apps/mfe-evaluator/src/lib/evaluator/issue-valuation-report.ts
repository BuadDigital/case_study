import {
  ensureOpenValuationRequestByProperty,
  getApiBase,
  getValuationReportDocument,
  getValuationReportPdf,
  type ValuationRequestLiteDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { cacheIssuedValuationReport } from "./evaluator-report-attachments";
import { reservedValuationReportNumber } from "./valuation-report-number";

function apiConfig() {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

function openFailureMessage(
  kind: "auth" | "network" | "server" | "validation" | "not_found",
): string {
  if (kind === "auth") return "تعذّر فتح طلب التقييم — تحقق من تسجيل الدخول.";
  if (kind === "network") return "تعذّر الاتصال بخدمة التقييم.";
  return "تعذّر فتح طلب التقييم لهذه المعاملة.";
}

export type EnsureValuationRequestInput = {
  propertyId: string;
  area?: string;
  propertyType?: string;
  appraiserName?: string;
};

export async function ensureOpenValuationRequest(
  input: EnsureValuationRequestInput,
): Promise<ValuationRequestLiteDto> {
  const config = apiConfig();
  const propertyId = input.propertyId.trim();
  if (!config || !propertyId) {
    throw new Error("تعذّر فتح طلب التقييم — تحقق من تسجيل الدخول.");
  }
  const open = await ensureOpenValuationRequestByProperty(config, {
    propId: propertyId,
    area: input.area?.trim() || "—",
    type: input.propertyType?.trim() || "—",
    appraiser: input.appraiserName?.trim() || "—",
  });
  if (!open.ok) {
    throw new Error(openFailureMessage(open.kind));
  }
  return open.data;
}

export function reservedNumberFromValuationRequest(
  request: ValuationRequestLiteDto,
): string {
  return reservedValuationReportNumber(request.displayId, request.date);
}

export type IssuedReportExtras = {
  reportNumber?: string | null;
  depositCode?: string | null;
};

export async function previewGeneratedValuationReport(input: {
  propertyId: string;
  extras?: IssuedReportExtras;
  area?: string;
  propertyType?: string;
  appraiserName?: string;
}): Promise<void> {
  const config = apiConfig();
  const open = await ensureOpenValuationRequest({
    propertyId: input.propertyId,
    area: input.area,
    propertyType: input.propertyType,
    appraiserName: input.appraiserName,
  });
  if (!config) {
    throw new Error("تعذّر فتح استعراض تقرير التقييم — تحقق من تسجيل الدخول.");
  }
  const res = await getValuationReportDocument(config, open.id);
  if (!res.ok) {
    throw new Error("تعذّر تحميل مستند التقرير.");
  }
  const reportNumber =
    input.extras?.reportNumber?.trim() ||
    reservedNumberFromValuationRequest(open);
  // تحميل شرطي — بنّاء المعاينة يُجلب عند أول استعراض لا مع حزم القوائم الفورية.
  const { openValuationReportPreview } = await import(
    "./valuation-report-preview"
  );
  await openValuationReportPreview(res.data, {
    ...input.extras,
    reportNumber,
  });
}

export async function snapshotIssuedValuationReport(input: {
  taskId: string;
  propertyId: string;
  reportNo: string;
  reportIssueDate: string;
  depositCode?: string;
  area?: string;
  propertyType?: string;
  appraiserName?: string;
}): Promise<void> {
  const config = apiConfig();
  const open = await ensureOpenValuationRequest({
    propertyId: input.propertyId,
    area: input.area,
    propertyType: input.propertyType,
    appraiserName: input.appraiserName,
  });
  if (!config) {
    throw new Error("تعذّر توليد تقرير التقييم — تحقق من تسجيل الدخول.");
  }

  const pdf = await getValuationReportPdf(config, open.id);
  if (!pdf.ok) {
    throw new Error("تعذّر إصدار ملف PDF للتقرير.");
  }

  const reportNo = input.reportNo.trim() || reservedNumberFromValuationRequest(open);
  const file = new File([pdf.data], `${reportNo || "valuation-report"}.pdf`, {
    type: "application/pdf",
  });
  const cached = await cacheIssuedValuationReport(input.taskId, file, reportNo);
  if (!cached.ok) {
    throw new Error(cached.error);
  }
}
