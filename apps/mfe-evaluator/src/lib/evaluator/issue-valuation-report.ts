import {
  ensureOpenValuationRequestByProperty,
  type ValuationRequestLiteDto,
} from "@platform/api-client";
import { apiConfig } from "./api-config";

function openFailureMessage(
  kind: "auth" | "network" | "server" | "validation" | "not_found" | "conflict",
): string {
  if (kind === "auth") return "تعذّر فتح طلب التقييم — يلزم تسجيل الدخول.";
  if (kind === "network") return "تعذّر الاتصال بخدمة التقييم.";
  if (kind === "conflict") return "طلب التقييم متعارض مع تحديث آخر — أعد المحاولة.";
  return "تعذّر فتح طلب التقييم لهذه المعاملة.";
}

type EnsureValuationRequestInput = {
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
    throw new Error("تعذّر فتح طلب التقييم — يلزم تسجيل الدخول.");
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
