import { loadSpecialistReportExtrasBag } from "@platform/app-shared/storage/specialist-report-extras-sync";

export type InfathDepositDraft = {
  depositCode: string;
  depositCertificateName: string;
};

/** Historical fallback for the evaluator's report deposit code — nothing writes here anymore. */
export function loadInfathDeposit(propertyId: string): InfathDepositDraft {
  if (typeof window === "undefined" || !propertyId.trim()) {
    return { depositCode: "", depositCertificateName: "" };
  }
  const parsed = loadSpecialistReportExtrasBag(propertyId).infathDeposit ?? {};
  return {
    depositCode: String(parsed.depositCode ?? "").trim(),
    depositCertificateName: String(parsed.depositCertificateName ?? "").trim(),
  };
}
