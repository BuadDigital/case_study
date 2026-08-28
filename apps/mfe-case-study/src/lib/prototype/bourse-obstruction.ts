import { reportBourseObstructionToSupervisor } from "@failures/mfe/lib/failures-repository";
import type { BourseDeedVitality } from "./po-intake-data";

export function validateBourseObstructionReason(
  vitality: BourseDeedVitality | null,
  reason: string,
): string | null {
  if (vitality !== "inactive") return null;
  if (!reason.trim()) return "يرجى توضيح سبب التعذر قبل الإرسال للمشرف.";
  return null;
}

export async function submitBourseObstruction(input: {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  reason: string;
  specialist: string;
}): Promise<void> {
  await reportBourseObstructionToSupervisor(input);
}
